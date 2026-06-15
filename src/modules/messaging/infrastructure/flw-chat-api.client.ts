export interface FlwChatApiClientConfig {
  chatBaseUrl: string
  coreBaseUrl?: string
  token: string
  fetch?: typeof fetch
}

export interface FlwAgentDetails {
  email?: string | null
}

export interface FlwSession {
  id: string
  startAt: string
  endAt: string | null
  contactId: string | null
  userId: string | null
  agentDetails?: FlwAgentDetails | null
  status: string
}

export interface FlwMessageDetails {
  file?: {
    publicUrl?: string | null
  } | null
  [key: string]: unknown
}

export interface FlwMessage {
  id: string
  sessionId: string
  direction: string
  origin: string
  type: string
  text: string | null
  userId: string | null
  createdAt: string
  details?: FlwMessageDetails | null
}

export interface FlwPaginatedResponse<T> {
  pageNumber: number
  pageSize: number
  items: T[]
  totalItems: number
  totalPages: number
  hasMorePages: boolean
}

export interface ListSessionsParams {
  pageNumber?: number
  pageSize?: number
  createdAtAfter?: string
  createdAtBefore?: string
}

export interface ListSessionMessagesParams {
  pageNumber?: number
  pageSize?: number
  createdAtAfter?: string
}

export class FlwChatApiError extends Error {
  readonly name = 'FlwChatApiError'

  constructor(
    readonly status: number,
    readonly statusText: string,
    readonly body: unknown,
    message?: string,
  ) {
    super(message ?? `FLW Chat API error: ${status} ${statusText}`)
  }
}

export class FlwChatApiClient {
  private readonly chatBaseUrl: string
  private readonly token: string
  private readonly fetchFn: typeof fetch

  constructor(config: FlwChatApiClientConfig) {
    this.chatBaseUrl = config.chatBaseUrl.replace(/\/$/, '')
    this.token = config.token
    this.fetchFn = config.fetch ?? fetch
  }

  async listSessions(params: ListSessionsParams = {}): Promise<FlwPaginatedResponse<FlwSession>> {
    const query = buildQuery({
      PageNumber: params.pageNumber,
      PageSize: params.pageSize,
      'CreatedAt.After': params.createdAtAfter,
      'CreatedAt.Before': params.createdAtBefore,
    })

    return this.request<FlwPaginatedResponse<FlwSession>>(`${this.chatBaseUrl}/v2/session${query}`)
  }

  async listSessionMessages(
    sessionId: string,
    params: ListSessionMessagesParams = {},
  ): Promise<FlwPaginatedResponse<FlwMessage>> {
    const query = buildQuery({
      PageNumber: params.pageNumber,
      PageSize: params.pageSize,
      'CreatedAt.After': params.createdAtAfter,
    })

    return this.request<FlwPaginatedResponse<FlwMessage>>(
      `${this.chatBaseUrl}/v1/session/${sessionId}/message${query}`,
    )
  }

  async getSession(sessionId: string): Promise<FlwSession> {
    return this.request<FlwSession>(`${this.chatBaseUrl}/v2/session/${sessionId}`)
  }

  private async request<T>(url: string): Promise<T> {
    const response = await this.fetchFn(url, {
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: 'application/json',
      },
    })

    if (!response.ok) {
      let body: unknown

      try {
        body = await response.json()
      } catch {
        body = await response.text()
      }

      throw new FlwChatApiError(response.status, response.statusText, body)
    }

    return response.json() as Promise<T>
  }
}

function buildQuery(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams()

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      search.set(key, String(value))
    }
  }

  const query = search.toString()
  return query ? `?${query}` : ''
}
