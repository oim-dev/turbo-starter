import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  createPublicationCategory,
  deletePublicationCategory,
  listAllPublicationCategories,
  listPublicationCategories,
  updatePublicationCategory
} from '../adapters/publication-categories.adapter'
import { publicationCategoryQueryKeys } from '../lib/publication-category-query-keys'
import type {
  AdminPublicationCategory,
  PublicationCategoryFilters,
  PublicationCategoryInput,
  PublicationCategoryPage
} from '../types/publication-category.type'

/**
 * Вход обновления категории из React UI.
 */
export type UpdatePublicationCategoryMutationInput = Readonly<{
  /** Актуальная категория. */
  category: AdminPublicationCategory
  /** Новые редактируемые поля. */
  input: PublicationCategoryInput
}>

/**
 * Подключает страницу категорий к React Query cache.
 */
export const usePublicationCategories = (filters: PublicationCategoryFilters) => {
  return useQuery<PublicationCategoryPage>({
    placeholderData: previousData => previousData,
    queryFn: ({ signal }) => listPublicationCategories(filters, signal),
    queryKey: publicationCategoryQueryKeys.list(filters)
  })
}

/**
 * Предоставляет полный список категорий для выбора в публикациях.
 */
export const useAllPublicationCategories = () => {
  return useQuery<AdminPublicationCategory[]>({
    queryFn: ({ signal }) => listAllPublicationCategories(signal),
    queryKey: publicationCategoryQueryKeys.options
  })
}

/**
 * Создаёт категорию и обновляет все списки владельца.
 */
export const useCreatePublicationCategory = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: PublicationCategoryInput) => createPublicationCategory(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: publicationCategoryQueryKeys.lists })
    }
  })
}

/**
 * Обновляет категорию и обновляет все списки владельца.
 */
export const useUpdatePublicationCategory = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ category, input }: UpdatePublicationCategoryMutationInput) => {
      return updatePublicationCategory(category.id, category.version, input)
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: publicationCategoryQueryKeys.lists }),
        queryClient.invalidateQueries({ queryKey: ['publications'] })
      ])
    }
  })
}

/**
 * Удаляет категорию и обновляет все списки владельца.
 */
export const useDeletePublicationCategory = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (category: AdminPublicationCategory) => {
      return deletePublicationCategory(category.id, category.version)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: publicationCategoryQueryKeys.lists })
    }
  })
}
