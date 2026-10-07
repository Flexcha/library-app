import { prisma } from '../../config/prisma.ts';
import { NotFoundError, ConflictError } from '../../common/errors/AppError.ts';
import { parsePagination, toPageResponse } from '../../common/pagination.ts';
import { CreateBookInput, UpdateBookInput } from './catalog.schema.ts';

export class BookService {
  static async list(query: any) {
    const { skip, take, page, size, orderBy } = parsePagination(query, 'id', 'desc');

    const where: any = {};

    if (query.categoryId) {
      where.categoryId = parseInt(query.categoryId, 10);
    }

    if (query.authorId) {
      where.bookAuthors = {
        some: {
          authorId: parseInt(query.authorId, 10),
        },
      };
    }

    const authorSearch = ((query as any).authorName || (query as any).author)?.trim();
    if (authorSearch) {
      where.bookAuthors = {
        some: {
          author: {
            name: { contains: authorSearch },
          },
        },
      };
    }

    if (query.q) {
      const searchTerm = query.q.trim();
      where.OR = [
        { title: { contains: searchTerm } },
        { isbn: { contains: searchTerm } },
        { subtitle: { contains: searchTerm } },
        {
          bookAuthors: {
            some: {
              author: {
                name: { contains: searchTerm },
              },
            },
          },
        },
      ];
    }

    const books = await prisma.book.findMany({
      where,
      include: {
        category: true,
        publisher: true,
        bookAuthors: {
          include: {
            author: true,
          },
        },
        copies: {
          select: {
            id: true,
            status: true,
          },
        },
      },
      orderBy,
    });

    // Format books and compute availability
    let formatted = books.map((b) => {
      const totalCopies = b.copies.length;
      const availableCopies = b.copies.filter((c) => c.status === 'AVAILABLE').length;

      return {
        id: b.id,
        isbn: b.isbn,
        title: b.title,
        subtitle: b.subtitle,
        description: b.description,
        coverImageUrl: b.coverImageUrl,
        publicationYear: b.publicationYear,
        language: b.language,
        edition: b.edition,
        pageCount: b.pageCount,
        category: b.category ? { id: b.category.id, name: b.category.name } : null,
        publisher: b.publisher ? { id: b.publisher.id, name: b.publisher.name } : null,
        authors: b.bookAuthors.map((ba) => ({ id: ba.author.id, name: ba.author.name })),
        totalCopies,
        availableCopies,
      };
    });

    if (query.availableOnly === 'true' || query.availableOnly === true) {
      formatted = formatted.filter((b) => b.availableCopies > 0);
    }

    const totalElements = formatted.length;
    const paginated = formatted.slice(skip, skip + take);

    return toPageResponse(paginated, totalElements, page, size);
  }

  static async getById(id: number) {
    const b = await prisma.book.findUnique({
      where: { id },
      include: {
        category: true,
        publisher: true,
        bookAuthors: {
          include: {
            author: true,
          },
        },
        copies: true,
      },
    });

    if (!b) {
      throw new NotFoundError(`Book with id ${id} not found`);
    }

    const totalCopies = b.copies.length;
    const availableCopies = b.copies.filter((c) => c.status === 'AVAILABLE').length;

    return {
      id: b.id,
      isbn: b.isbn,
      title: b.title,
      subtitle: b.subtitle,
      description: b.description,
      coverImageUrl: b.coverImageUrl,
      publicationYear: b.publicationYear,
      language: b.language,
      edition: b.edition,
      pageCount: b.pageCount,
      category: b.category ? { id: b.category.id, name: b.category.name, description: b.category.description } : null,
      publisher: b.publisher ? { id: b.publisher.id, name: b.publisher.name, website: b.publisher.website } : null,
      authors: b.bookAuthors.map((ba) => ({ id: ba.author.id, name: ba.author.name, nationality: ba.author.nationality })),
      copies: b.copies.map((c) => ({
        id: c.id,
        copyCode: c.copyCode,
        status: c.status,
        shelfLocation: c.shelfLocation,
        acquisitionDate: c.acquisitionDate,
      })),
      totalCopies,
      availableCopies,
    };
  }

  static async create(data: CreateBookInput) {
    const existing = await prisma.book.findUnique({
      where: { isbn: data.isbn },
    });

    if (existing) {
      throw new ConflictError('A book with this ISBN already exists', 'DUPLICATE_ISBN');
    }

    // Resolve publisher ID from string name if provided
    let finalPublisherId = data.publisherId || null;
    const pubName = (data as any).publisherName ?? (data as any).publisher;
    if (pubName && typeof pubName === 'string' && pubName.trim()) {
      const trimmed = pubName.trim();
      let pub = await prisma.publisher.findFirst({
        where: { name: { equals: trimmed, mode: 'insensitive' } },
      });
      if (!pub) {
        pub = await prisma.publisher.create({ data: { name: trimmed } });
      }
      finalPublisherId = pub.id;
    }

    const book = await prisma.book.create({
      data: {
        isbn: data.isbn,
        title: data.title,
        subtitle: data.subtitle,
        publisherId: finalPublisherId,
        categoryId: data.categoryId || null,
        language: data.language || 'Vietnamese',
        edition: data.edition,
        publicationYear: data.publicationYear,
        pageCount: data.pageCount,
        description: data.description,
        coverImageUrl: data.coverImageUrl,
      },
    });

    // Generate initial book copies if specified (default 1 copy)
    const initialCopiesCount = Math.max(1, Number((data as any).initialCopies) || 1);
    const copiesData = Array.from({ length: initialCopiesCount }, (_, i) => ({
      bookId: book.id,
      copyCode: `CP-${book.id}-${String(i + 1).padStart(2, '0')}`,
      status: 'AVAILABLE',
    }));
    await prisma.bookCopy.createMany({ data: copiesData });

    // Resolve author IDs from both authorIds and input author name(s)
    const resolvedAuthorIds: number[] = [...(data.authorIds || [])];
    const rawAuthorInput = (data as any).authorNames ?? (data as any).authors;

    if (rawAuthorInput) {
      const names: string[] = Array.isArray(rawAuthorInput)
        ? rawAuthorInput
        : String(rawAuthorInput).split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean);

      for (const name of names) {
        const trimmed = name.trim();
        if (!trimmed) continue;
        let author = await prisma.author.findFirst({
          where: { name: trimmed },
        });
        if (!author) {
          author = await prisma.author.create({
            data: { name: trimmed },
          });
        }
        if (!resolvedAuthorIds.includes(author.id)) {
          resolvedAuthorIds.push(author.id);
        }
      }
    }

    if (resolvedAuthorIds.length > 0) {
      await prisma.bookAuthor.createMany({
        data: resolvedAuthorIds.map((authorId) => ({
          bookId: book.id,
          authorId,
        })),
      });
    }

    return this.getById(book.id);
  }

  static async update(id: number, data: UpdateBookInput) {
    const existing = await prisma.book.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError(`Book with id ${id} not found`);
    }

    if (data.isbn && data.isbn !== existing.isbn) {
      const conflict = await prisma.book.findUnique({ where: { isbn: data.isbn } });
      if (conflict) {
        throw new ConflictError('A book with this ISBN already exists', 'DUPLICATE_ISBN');
      }
    }

    // Resolve publisher ID from string name if provided
    let updatedPublisherId: number | null | undefined = data.publisherId !== undefined ? data.publisherId : undefined;
    const pubName = (data as any).publisherName ?? (data as any).publisher;
    if (pubName && typeof pubName === 'string' && pubName.trim()) {
      const trimmed = pubName.trim();
      let pub = await prisma.publisher.findFirst({
        where: { name: { equals: trimmed, mode: 'insensitive' } },
      });
      if (!pub) {
        pub = await prisma.publisher.create({ data: { name: trimmed } });
      }
      updatedPublisherId = pub.id;
    }

    await prisma.book.update({
      where: { id },
      data: {
        isbn: data.isbn,
        title: data.title,
        subtitle: data.subtitle,
        publisherId: updatedPublisherId,
        categoryId: data.categoryId !== undefined ? data.categoryId : undefined,
        language: data.language,
        edition: data.edition,
        publicationYear: data.publicationYear,
        pageCount: data.pageCount,
        description: data.description,
        coverImageUrl: data.coverImageUrl,
      },
    });

    const rawAuthorInput = (data as any).authorNames ?? (data as any).authors;
    if (data.authorIds !== undefined || rawAuthorInput !== undefined) {
      const resolvedAuthorIds: number[] = [...(data.authorIds || [])];

      if (rawAuthorInput) {
        const names: string[] = Array.isArray(rawAuthorInput)
          ? rawAuthorInput
          : String(rawAuthorInput).split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean);

        for (const name of names) {
          const trimmed = name.trim();
          if (!trimmed) continue;
          let author = await prisma.author.findFirst({
            where: { name: trimmed },
          });
          if (!author) {
            author = await prisma.author.create({
              data: { name: trimmed },
            });
          }
          if (!resolvedAuthorIds.includes(author.id)) {
            resolvedAuthorIds.push(author.id);
          }
        }
      }

      await prisma.bookAuthor.deleteMany({ where: { bookId: id } });
      if (resolvedAuthorIds.length > 0) {
        await prisma.bookAuthor.createMany({
          data: resolvedAuthorIds.map((authorId) => ({
            bookId: id,
            authorId,
          })),
        });
      }
    }

    return this.getById(id);
  }

  static async delete(id: number) {
    const book = await prisma.book.findUnique({
      where: { id },
      include: {
        copies: {
          include: {
            loans: {
              where: {
                status: {
                  in: ['ONGOING', 'OVERDUE'],
                },
              },
            },
          },
        },
      },
    });

    if (!book) {
      throw new NotFoundError(`Book with id ${id} not found`);
    }

    const hasActiveLoan = book.copies.some((c) => c.loans.length > 0);
    if (hasActiveLoan) {
      throw new ConflictError('Cannot delete book with active loans on its copies', 'BOOK_ON_LOAN');
    }

    await prisma.book.delete({ where: { id } });
    return { message: 'Book deleted successfully' };
  }
}
