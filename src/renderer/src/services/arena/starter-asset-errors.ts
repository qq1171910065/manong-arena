export class StarterAssetFetchError extends Error {
  readonly code = 'STARTER_ASSET_FETCH_FAILED'

  constructor(message: string) {
    super(message)
    this.name = 'StarterAssetFetchError'
  }
}
