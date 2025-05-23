import {
    PatreonClientMethods,
    type Oauth2FetchOptions,
    type Oauth2RouteOptions,
    type ResponseTransformMap,
    type ResponseTransformType,
} from './baseMethods'

import {
    type Oauth2CreatorToken,
    type Oauth2StoredToken,
    type Oauth2Token,
    type PatreonOauthClientOptions,
} from '../oauth2/client'

import {
    type PatreonTokenFetchOptions,
    type RESTOptions,
} from '../oauth2'
import { WebhookClient } from '../webhooks'

export type {
    ResponseTransformMap,
    ResponseTransformType,
    Oauth2CreatorToken,
    Oauth2StoredToken,
    Oauth2Token,
    Oauth2FetchOptions,
    Oauth2RouteOptions,
}

/**
 * The constructor options for API applications
 */
export interface PatreonClientOptions<IncludeAll extends boolean = false> {
    /**
     * The Oauth options for this client.
     * Required for both creator and user clients.
     */
    oauth: PatreonOauthClientOptions

    /**
     * The application name of this client
     */
    name?: string

    /**
     * The rest options for this client
     */
    rest?: Partial<RESTOptions<IncludeAll>>

    /**
     * Options for storing and getting API (creator) tokens.
     * @default undefined
     */
    store?: PatreonTokenFetchOptions
}

export abstract class PatreonClient<IncludeAll extends boolean = false> extends PatreonClientMethods<IncludeAll> {
    private store: PatreonTokenFetchOptions | undefined = undefined

    /**
     * Interact with the webhooks API.
     *
     * Client to use for creating, updating and getting webhooks from the current client.
     */
    public webhooks: WebhookClient

    public constructor(options: PatreonClientOptions<IncludeAll>, type: 'oauth' | 'creator') {
        options.oauth.tokenType ??= type

        super(options.oauth, options.rest, {
            name: options.name ?? null,
        })
        this.webhooks = new WebhookClient(this.oauth)

        this.store = options.store

        this.oauth.onTokenRefreshed = async (token) => {
            if (token) await this.putStoredToken?.(token, true)
        }

        this.oauth['rest'].options.getAccessToken ??= async () => {
            return await this.fetchStoredToken()
                .then(token => token?.access_token)
        }
    }

    protected static async fetchStored(store?: PatreonTokenFetchOptions): Promise<Oauth2StoredToken | undefined> {
        const stored = await store?.get()
        if (stored == undefined) return undefined

        const { expires_in_epoch } = stored
        stored.expires_in = (Math.round((parseInt(expires_in_epoch) - Date.now()) / 1000)).toString()
        return stored
    }

    /**
     * Fetch the stored token with the `get` method from the client options
     * @returns the stored token, if `options.store.get` is defined and returns succesfully.
     */
    public async fetchStoredToken(): Promise<Oauth2StoredToken | undefined> {
        return PatreonClient.fetchStored(this.store)
    }

    /**
     * Save your token with the method from the client options
     * @param token The token to save
     * @param [cache] Whether to overwrite the application token cache and update it with the token
     */
    public async putStoredToken(token: Oauth2StoredToken, cache?: boolean): Promise<void> {
        await this.store?.put(token)
        if (cache) this.oauth.cachedToken = token
    }
}
