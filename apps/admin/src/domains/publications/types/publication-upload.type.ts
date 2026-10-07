/**
 * Source-neutral upload intent трёхшаговой загрузки артефакта.
 */
export type PublicationUploadIntent = {
  /** UUID создаваемого артефакта. */
  artifactId: string
  /** Поля подписанного object storage POST. */
  fields: Record<string, string>
  /** Подписанный URL object storage. */
  url: string
}
