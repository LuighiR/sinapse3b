export type AuthContext = {
  userId: string
  tenantId: string
  clientId: string
  user: {
    id: string
    email: string
    name: string | null
  }
  membership: {
    tenantId: string
    userId: string
    role: 'OWNER' | 'ADMIN' | 'MANAGER' | 'VIEWER'
  }
  tenant: {
    id: string
    name: string
    slug: string
    backendClientId: string
  }
  client: {
    id: string
    name: string
  }
}
