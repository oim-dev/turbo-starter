import useSWR from 'swr'
import type { SWRResponse } from 'swr'
import { getSignInMethods } from '../../adapters/get-sign-in-methods.adapter'
import type { GetSignInMethodsError } from '../../errors/auth.error'
import type { SignInMethods } from '../../types/sign-in-methods.type'
import { getSignInMethodsKey } from './get-sign-in-methods-key'

/**
 * Связывает публичный список методов входа с жизненным циклом интерфейса.
 */
export const useGetSignInMethods = (): SWRResponse<SignInMethods, GetSignInMethodsError> => {
  return useSWR<SignInMethods, GetSignInMethodsError>(getSignInMethodsKey(), getSignInMethods, {
    shouldRetryOnError: false
  })
}
