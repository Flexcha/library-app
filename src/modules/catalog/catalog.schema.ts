import { z } from 'zod';

export const authorSchema = z.object({
  name: z.string().min(1, 'Author name is required'),
  biography: z.string().optional(),
  birthDate: z.string().optional(),
  nationality: z.string().optional(),
});

export const categorySchema = z.object({
  name: z.string().min(1, 'Category name is required'),
  description: z.string().optional(),
  parentCategoryId: z.number().nullable().optional(),
});

export const publisherSchema = z.object({
  name: z.string().min(1, 'Publisher name is required'),
  address: z.string().optional(),
  website: z.string().optional(),
});

export const bookCopySchema = z.object({
  copyCode: z.string().min(1, 'Copy code is required'),
  shelfLocation: z.string().optional(),
  acquisitionDate: z.string().optional(),
});

export const updateCopyStatusSchema = z.object({
  status: z.enum(['AVAILABLE', 'BORROWED', 'RESERVED', 'LOST', 'DAMAGED', 'WITHDRAWN']),
});

export const createBookSchema = z.object({
  isbn: z.string().min(1, 'ISBN is required'),
  title: z.string().min(1, 'Title is required'),
  subtitle: z.string().optional(),
  publisherId: z.number().nullable().optional(),
  publisherName: z.string().optional(),
  publisher: z.union([z.string(), z.number()]).optional(),
  categoryId: z.number().nullable().optional(),
  authorIds: z.array(z.number()).optional(),
  authorNames: z.union([z.string(), z.array(z.string())]).optional(),
  authors: z.union([z.string(), z.array(z.string())]).optional(),
  language: z.string().default('Vietnamese').optional(),
  edition: z.string().optional(),
  publicationYear: z.number().optional(),
  pageCount: z.number().optional(),
  description: z.string().optional(),
  coverImageUrl: z.string().optional(),
  initialCopies: z.number().optional(),
});

export const updateBookSchema = createBookSchema.partial();

export const bookQuerySchema = z.object({
  page: z.string().optional(),
  size: z.string().optional(),
  sort: z.string().optional(),
  q: z.string().optional(),
  categoryId: z.string().optional(),
  authorId: z.string().optional(),
  author: z.string().optional(),
  authorName: z.string().optional(),
  availableOnly: z.string().optional(),
});

export type AuthorInput = z.infer<typeof authorSchema>;
export type CategoryInput = z.infer<typeof categorySchema>;
export type PublisherInput = z.infer<typeof publisherSchema>;
export type BookCopyInput = z.infer<typeof bookCopySchema>;
export type UpdateCopyStatusInput = z.infer<typeof updateCopyStatusSchema>;
export type CreateBookInput = z.infer<typeof createBookSchema>;
export type UpdateBookInput = z.infer<typeof updateBookSchema>;
