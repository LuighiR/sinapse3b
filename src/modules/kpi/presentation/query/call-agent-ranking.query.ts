import { parseCallFactFiltersQuery, type CallFactFiltersQuery } from './call-filters.query'

export type CallAgentRankingQuery = CallFactFiltersQuery & {
  registeredEmployeesOnly?: boolean
}

export function parseCallAgentRankingQuery(query: Record<string, unknown>): CallAgentRankingQuery {
  const registeredEmployeesOnly = parseOptionalBoolean(query.registeredEmployeesOnly)

  return {
    ...parseCallFactFiltersQuery(query, 'Invalid call agent ranking query params'),
    ...(registeredEmployeesOnly === undefined ? {} : { registeredEmployeesOnly }),
  }
}

function parseOptionalBoolean(value: unknown): boolean | undefined {
  if (value == null || value === '') {
    return undefined
  }

  if (value === true || value === 'true' || value === '1') {
    return true
  }

  if (value === false || value === 'false' || value === '0') {
    return false
  }

  return undefined
}
