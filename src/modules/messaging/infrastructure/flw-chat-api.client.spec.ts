import { FlwChatApiClient, FlwChatApiError } from './flw-chat-api.client'

describe('FlwChatApiClient', () => {
  const chatBaseUrl = 'https://api.wts.chat/chat'
  const token = 'test-token'

  let fetchMock: jest.Mock

  beforeEach(() => {
    fetchMock = jest.fn()
  })

  function createClient() {
    return new FlwChatApiClient({
      chatBaseUrl,
      token,
      fetch: fetchMock as unknown as typeof fetch,
    })
  }

  function jsonResponse(body: unknown, status = 200) {
    return {
      ok: status >= 200 && status < 300,
      status,
      statusText: status === 200 ? 'OK' : 'Unauthorized',
      json: jest.fn().mockResolvedValue(body),
      text: jest.fn().mockResolvedValue(JSON.stringify(body)),
    }
  }

  it('builds correct Authorization header', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        items: [],
        pageNumber: 1,
        pageSize: 15,
        totalItems: 0,
        totalPages: 0,
        hasMorePages: false,
      }),
    )

    await createClient().listSessions()

    expect(fetchMock).toHaveBeenCalledWith(
      `${chatBaseUrl}/v2/session`,
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test-token',
          Accept: 'application/json',
        }),
      }),
    )
  })

  it('listSessions calls correct URL with query params', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        items: [],
        pageNumber: 2,
        pageSize: 50,
        totalItems: 0,
        totalPages: 0,
        hasMorePages: false,
      }),
    )

    await createClient().listSessions({
      pageNumber: 2,
      pageSize: 50,
      createdAtAfter: '2026-01-01T00:00:00Z',
      createdAtBefore: '2026-06-01T00:00:00Z',
    })

    const calledUrl = fetchMock.mock.calls[0][0] as string
    const url = new URL(calledUrl)

    expect(url.origin + url.pathname).toBe(`${chatBaseUrl}/v2/session`)
    expect(url.searchParams.get('PageNumber')).toBe('2')
    expect(url.searchParams.get('PageSize')).toBe('50')
    expect(url.searchParams.get('CreatedAt.After')).toBe('2026-01-01T00:00:00Z')
    expect(url.searchParams.get('CreatedAt.Before')).toBe('2026-06-01T00:00:00Z')
  })

  it('listSessionMessages paginates', async () => {
    const sessionId = '11111111-1111-1111-1111-111111111111'
    const page = {
      pageNumber: 3,
      pageSize: 25,
      items: [
        {
          id: '22222222-2222-2222-2222-222222222222',
          sessionId,
          direction: 'TO_HUB',
          origin: 'DEFAULT',
          type: 'TEXT',
          text: 'Olá',
          userId: null,
          createdAt: '2026-02-01T10:00:00Z',
          details: null,
        },
      ],
      totalItems: 100,
      totalPages: 4,
      hasMorePages: true,
    }
    fetchMock.mockResolvedValue(jsonResponse(page))

    const result = await createClient().listSessionMessages(sessionId, {
      pageNumber: 3,
      pageSize: 25,
      createdAtAfter: '2026-02-01T00:00:00Z',
    })

    const calledUrl = fetchMock.mock.calls[0][0] as string
    const url = new URL(calledUrl)

    expect(url.origin + url.pathname).toBe(`${chatBaseUrl}/v1/session/${sessionId}/message`)
    expect(url.searchParams.get('PageNumber')).toBe('3')
    expect(url.searchParams.get('PageSize')).toBe('25')
    expect(url.searchParams.get('CreatedAt.After')).toBe('2026-02-01T00:00:00Z')
    expect(result).toEqual(page)
  })

  it('propagates HTTP errors', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        {
          error: true,
          text: 'Unauthorized',
        },
        401,
      ),
    )

    await expect(createClient().listSessions()).rejects.toBeInstanceOf(FlwChatApiError)
    await expect(createClient().listSessions()).rejects.toMatchObject({
      status: 401,
      statusText: 'Unauthorized',
      body: {
        error: true,
        text: 'Unauthorized',
      },
    })
  })
})
