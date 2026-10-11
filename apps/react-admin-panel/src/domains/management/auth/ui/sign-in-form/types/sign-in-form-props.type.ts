import type { ComponentPropsWithoutRef } from 'react'

/** Атрибуты формы, сохраняющие доменное владение отправкой и полями. */
type RootAttrs = Omit<ComponentPropsWithoutRef<'form'>, 'children' | 'onSubmit' | 'noValidate'>

/** Свойства размещаемой формы входа. */
export type SignInFormProps = RootAttrs
