import { useMutation } from '@tanstack/react-query'
import type { UseMutationResult } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'

import { uploadPublicationImage } from '../services/upload-publication-image.service'
import type { PublicationArtifact } from '../types/publication.type'

/**
 * Владеет cancellation lifecycle одной активной загрузки изображения.
 */
export const usePublicationImageUpload = (): UseMutationResult<PublicationArtifact, Error, File> => {
  const controllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    return () => {
      controllerRef.current?.abort()
      controllerRef.current = null
    }
  }, [])

  return useMutation({
    mutationFn: async (file: File) => {
      controllerRef.current?.abort()
      const controller = new AbortController()
      controllerRef.current = controller

      try {
        return await uploadPublicationImage(file, { signal: controller.signal })
      } finally {
        if (controllerRef.current === controller) {
          controllerRef.current = null
        }
      }
    }
  })
}
