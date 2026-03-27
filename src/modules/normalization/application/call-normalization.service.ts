import { Inject, Injectable } from '@nestjs/common'
import { PrismaService } from '../../../infra/prisma/prisma.service'

export const RAW_FERRACO_CALL_READER = 'RAW_FERRACO_CALL_READER'
export const CALL_FACT_UPSERT_REPOSITORY = 'CALL_FACT_UPSERT_REPOSITORY'

export type RawFerracoCallRecord = {
  id: number | string
  clientId: string
  domainUuid: string | null
  xmlCdrUuid: string | null
  extensionUuid: string | null
  direction: string | null
  callerNumber: string | null
  destinationNumber: string | null
  dateStart: string | Date
  dateFinal: string | Date | null
  duration: string | number | null
  recordPath: string | null
  recordName: string | null
  hangupCause: string | null
  sipHangupDisposition: string | null
  payload: Record<string, unknown> | null
}

export type CallFactWritePayload = {
  clientId: string
  sourceTable: string
  sourceRecordId: number
  domainUuid: string | null
  xmlCdrUuid: string | null
  direction: string | null
  callerNumber: string | null
  destinationNumber: string | null
  extensionUuid: string | null
  startedAt: Date
  endedAt: Date | null
  durationSeconds: string
  recordPath: string | null
  recordName: string | null
  hangupCause: string | null
  sipHangupDisposition: string | null
  isInboundToCompany: boolean
  isReceived: boolean
  isLost: boolean
  agentResolutionType: string | null
  agentResolutionKey: string | null
  agentExtensionNumber: string | null
  payloadJson: Record<string, unknown>
}

export type CallFactUpsertArgs = {
  where: {
    clientId_sourceTable_sourceRecordId: {
      clientId: string
      sourceTable: string
      sourceRecordId: number
    }
  }
  create: CallFactWritePayload
  update: CallFactWritePayload
}

export type RawFerracoCallReader = {
  findByClientId(clientId: string): Promise<RawFerracoCallRecord[]>
  countByClientId?(clientId: string): Promise<number>
}

export type CallFactUpsertRepository = {
  upsert(args: CallFactUpsertArgs): Promise<void>
  bulkUpsertClient?(clientId: string): Promise<void>
}

export type CallNormalizationResult = {
  recordsRead: number
  recordsWritten: number
}

type PrismaCallFactDelegate = {
  callFact: {
    upsert(args: unknown): Promise<unknown>
  }
}

@Injectable()
export class PrismaRawFerracoCallReader implements RawFerracoCallReader {
  constructor(private readonly prisma: PrismaService) {}

  async countByClientId(clientId: string): Promise<number> {
    const rows = await this.prisma.$queryRaw<Array<{ count: string | number | bigint }>>`
      SELECT count(*)::text AS count
      FROM raw.ferraco_calls AS call
      INNER JOIN core.sinapse_clients AS client
        ON client.domain_uuid = call.domain_uuid
      WHERE client.id = ${clientId}
    `

    return Number(rows[0]?.count ?? 0)
  }

  async findByClientId(clientId: string): Promise<RawFerracoCallRecord[]> {
    return this.prisma.$queryRaw<RawFerracoCallRecord[]>`
      SELECT
        call.id,
        client.id AS "clientId",
        call.domain_uuid AS "domainUuid",
        call.xml_cdr_uuid AS "xmlCdrUuid",
        call.extension_uuid AS "extensionUuid",
        call.direction,
        call.caller_id_number AS "callerNumber",
        call.destination_number AS "destinationNumber",
        call.date_start AS "dateStart",
        call.date_final AS "dateFinal",
        call.duration::text AS duration,
        call.record_path AS "recordPath",
        call.record_name AS "recordName",
        call.hangup_cause AS "hangupCause",
        call.sip_hangup_disposition AS "sipHangupDisposition",
        row_to_json(call) AS payload
      FROM raw.ferraco_calls AS call
      INNER JOIN core.sinapse_clients AS client
        ON client.domain_uuid = call.domain_uuid
      WHERE client.id = ${clientId}
      ORDER BY call.id ASC
    `
  }
}

@Injectable()
export class PrismaCallFactUpsertRepository implements CallFactUpsertRepository {
  constructor(private readonly prisma: PrismaService) {}

  async upsert(args: CallFactUpsertArgs): Promise<void> {
    const callFactDelegate = (this.prisma as unknown as PrismaCallFactDelegate).callFact

    await callFactDelegate.upsert(args)
  }

  async bulkUpsertClient(clientId: string): Promise<void> {
    await this.prisma.$executeRawUnsafe(
      `
      INSERT INTO core.call_facts (
        client_id,
        source_table,
        source_record_id,
        domain_uuid,
        xml_cdr_uuid,
        direction,
        caller_number,
        destination_number,
        extension_uuid,
        started_at,
        ended_at,
        duration_seconds,
        record_path,
        record_name,
        hangup_cause,
        sip_hangup_disposition,
        is_inbound_to_company,
        is_received,
        is_lost,
        agent_resolution_type,
        agent_resolution_key,
        agent_extension_number,
        payload_json
      )
      SELECT
        client.id,
        'raw.ferraco_calls',
        call.id,
        call.domain_uuid,
        call.xml_cdr_uuid,
        call.direction,
        call.caller_id_number,
        call.destination_number,
        NULLIF(call.extension_uuid, ''),
        call.date_start,
        call.date_final,
        COALESCE(call.duration, 0),
        call.record_path,
        call.record_name,
        call.hangup_cause,
        call.sip_hangup_disposition,
        (
          call.direction = 'inbound'
          AND COALESCE(call.destination_number, '') ~ '^\\d{2,5}$'
          AND COALESCE(call.caller_id_number, '') !~ '^\\d{2,5}$'
        ),
        (
          call.direction = 'inbound'
          AND COALESCE(call.destination_number, '') ~ '^\\d{2,5}$'
          AND COALESCE(call.caller_id_number, '') !~ '^\\d{2,5}$'
          AND NULLIF(call.extension_uuid, '') IS NOT NULL
          AND COALESCE(call.sip_hangup_disposition, '') NOT IN ('recv_cancel', 'send_cancel', 'send_refuse')
        ),
        (
          call.direction = 'inbound'
          AND COALESCE(call.destination_number, '') ~ '^\\d{2,5}$'
          AND COALESCE(call.caller_id_number, '') !~ '^\\d{2,5}$'
          AND COALESCE(call.sip_hangup_disposition, '') IN ('recv_cancel', 'send_cancel', 'send_refuse')
        ),
        CASE
          WHEN NULLIF(call.extension_uuid, '') IS NOT NULL THEN 'EXTENSION_UUID'
          WHEN (
            call.direction = 'inbound'
            AND COALESCE(call.destination_number, '') ~ '^\\d{2,5}$'
            AND COALESCE(call.caller_id_number, '') !~ '^\\d{2,5}$'
            AND COALESCE(call.sip_hangup_disposition, '') IN ('recv_cancel', 'send_cancel', 'send_refuse')
          ) THEN 'EXTENSION_NUMBER'
          ELSE NULL
        END,
        CASE
          WHEN NULLIF(call.extension_uuid, '') IS NOT NULL THEN NULLIF(call.extension_uuid, '')
          WHEN (
            call.direction = 'inbound'
            AND COALESCE(call.destination_number, '') ~ '^\\d{2,5}$'
            AND COALESCE(call.caller_id_number, '') !~ '^\\d{2,5}$'
            AND COALESCE(call.sip_hangup_disposition, '') IN ('recv_cancel', 'send_cancel', 'send_refuse')
          ) THEN call.destination_number
          ELSE NULL
        END,
        CASE
          WHEN (
            call.direction = 'inbound'
            AND COALESCE(call.destination_number, '') ~ '^\\d{2,5}$'
            AND COALESCE(call.caller_id_number, '') !~ '^\\d{2,5}$'
          ) THEN call.destination_number
          ELSE NULL
        END,
        row_to_json(call)
      FROM raw.ferraco_calls AS call
      INNER JOIN core.sinapse_clients AS client
        ON client.domain_uuid = call.domain_uuid
      WHERE client.id = $1
      ON CONFLICT (client_id, source_table, source_record_id)
      DO UPDATE SET
        domain_uuid = EXCLUDED.domain_uuid,
        xml_cdr_uuid = EXCLUDED.xml_cdr_uuid,
        direction = EXCLUDED.direction,
        caller_number = EXCLUDED.caller_number,
        destination_number = EXCLUDED.destination_number,
        extension_uuid = EXCLUDED.extension_uuid,
        started_at = EXCLUDED.started_at,
        ended_at = EXCLUDED.ended_at,
        duration_seconds = EXCLUDED.duration_seconds,
        record_path = EXCLUDED.record_path,
        record_name = EXCLUDED.record_name,
        hangup_cause = EXCLUDED.hangup_cause,
        sip_hangup_disposition = EXCLUDED.sip_hangup_disposition,
        is_inbound_to_company = EXCLUDED.is_inbound_to_company,
        is_received = EXCLUDED.is_received,
        is_lost = EXCLUDED.is_lost,
        agent_resolution_type = EXCLUDED.agent_resolution_type,
        agent_resolution_key = EXCLUDED.agent_resolution_key,
        agent_extension_number = EXCLUDED.agent_extension_number,
        payload_json = EXCLUDED.payload_json,
        updated_at = NOW()
      `,
      clientId,
    )
  }
}

@Injectable()
export class CallNormalizationService {
  private readonly sourceTable = 'raw.ferraco_calls'
  private readonly upsertBatchSize = 250
  private readonly shortExtensionPattern = /^\d{2,5}$/

  constructor(
    @Inject(RAW_FERRACO_CALL_READER)
    private readonly rawReader: RawFerracoCallReader,
    @Inject(CALL_FACT_UPSERT_REPOSITORY)
    private readonly callFactRepository: CallFactUpsertRepository,
  ) {}

  async normalizeClientCalls(clientId: string): Promise<CallNormalizationResult> {
    const recordsRead = await this.countRawCalls(clientId)

    if (recordsRead === 0) {
      return {
        recordsRead: 0,
        recordsWritten: 0,
      }
    }

    if (this.callFactRepository.bulkUpsertClient) {
      await this.callFactRepository.bulkUpsertClient(clientId)

      return {
        recordsRead,
        recordsWritten: recordsRead,
      }
    }

    const calls = await this.rawReader.findByClientId(clientId)
    const normalizedCalls = calls.map((call) => this.normalizeCall(clientId, call))

    for (let index = 0; index < normalizedCalls.length; index += this.upsertBatchSize) {
      const batch = normalizedCalls.slice(index, index + this.upsertBatchSize)

      await Promise.all(
        batch.map((normalizedCall) =>
          this.callFactRepository.upsert({
            where: {
              clientId_sourceTable_sourceRecordId: {
                clientId,
                sourceTable: this.sourceTable,
                sourceRecordId: normalizedCall.sourceRecordId,
              },
            },
            create: normalizedCall,
            update: normalizedCall,
          }),
        ),
      )
    }

    return {
      recordsRead,
      recordsWritten: normalizedCalls.length,
    }
  }

  private async countRawCalls(clientId: string): Promise<number> {
    if (this.rawReader.countByClientId) {
      return this.rawReader.countByClientId(clientId)
    }

    const calls = await this.rawReader.findByClientId(clientId)
    return calls.length
  }

  private normalizeCall(clientId: string, call: RawFerracoCallRecord): CallFactWritePayload {
    const isInboundToCompany = this.isInboundToCompany(call)
    const isLost = isInboundToCompany && this.isLostDisposition(call.sipHangupDisposition)
    const isReceived = isInboundToCompany && this.hasText(call.extensionUuid) && !isLost

    return {
      clientId,
      sourceTable: this.sourceTable,
      sourceRecordId: this.parseNumber(call.id, 'id'),
      domainUuid: this.normalizeOptionalText(call.domainUuid),
      xmlCdrUuid: this.normalizeOptionalText(call.xmlCdrUuid),
      direction: this.normalizeOptionalText(call.direction),
      callerNumber: this.normalizeOptionalText(call.callerNumber),
      destinationNumber: this.normalizeOptionalText(call.destinationNumber),
      extensionUuid: this.normalizeOptionalText(call.extensionUuid),
      startedAt: this.parseTimestamp(call.dateStart, 'dateStart'),
      endedAt: this.parseOptionalTimestamp(call.dateFinal),
      durationSeconds: this.parseDecimalString(call.duration),
      recordPath: this.normalizeOptionalText(call.recordPath),
      recordName: this.normalizeOptionalText(call.recordName),
      hangupCause: this.normalizeOptionalText(call.hangupCause),
      sipHangupDisposition: this.normalizeOptionalText(call.sipHangupDisposition),
      isInboundToCompany,
      isLost,
      isReceived,
      agentResolutionType: this.resolveAgentResolutionType(call, isInboundToCompany, isLost),
      agentResolutionKey: this.resolveAgentResolutionKey(call, isInboundToCompany, isLost),
      agentExtensionNumber: isInboundToCompany ? this.normalizeOptionalText(call.destinationNumber) : null,
      payloadJson: call.payload ?? {},
    }
  }

  private isInboundToCompany(call: RawFerracoCallRecord): boolean {
    const direction = this.normalizeOptionalText(call.direction)
    const destinationNumber = this.normalizeOptionalText(call.destinationNumber)
    const callerNumber = this.normalizeOptionalText(call.callerNumber)

    if (direction !== 'inbound') {
      return false
    }

    if (!this.isShortExtension(destinationNumber)) {
      return false
    }

    if (this.isShortExtension(callerNumber)) {
      return false
    }

    return true
  }

  private isLostDisposition(value: string | null): boolean {
    return value === 'recv_cancel' || value === 'send_cancel' || value === 'send_refuse'
  }

  private resolveAgentResolutionType(
    call: RawFerracoCallRecord,
    isInboundToCompany: boolean,
    isLost: boolean,
  ): string | null {
    if (this.hasText(call.extensionUuid)) {
      return 'EXTENSION_UUID'
    }

    if (isInboundToCompany && isLost && this.hasText(call.destinationNumber)) {
      return 'EXTENSION_NUMBER'
    }

    return null
  }

  private resolveAgentResolutionKey(
    call: RawFerracoCallRecord,
    isInboundToCompany: boolean,
    isLost: boolean,
  ): string | null {
    if (this.hasText(call.extensionUuid)) {
      return this.normalizeOptionalText(call.extensionUuid)
    }

    if (isInboundToCompany && isLost && this.hasText(call.destinationNumber)) {
      return this.normalizeOptionalText(call.destinationNumber)
    }

    return null
  }

  private parseNumber(value: number | string | null, fieldName: string): number {
    if (value == null || value === '') {
      throw new Error(`Missing required call field: ${fieldName}`)
    }

    const parsedValue = Number(value)

    if (!Number.isFinite(parsedValue)) {
      throw new Error(`Invalid numeric call field: ${fieldName}`)
    }

    return parsedValue
  }

  private parseTimestamp(value: string | Date, fieldName: string): Date {
    const parsed = value instanceof Date ? value : new Date(value)

    if (Number.isNaN(parsed.getTime())) {
      throw new Error(`Invalid timestamp call field: ${fieldName}`)
    }

    return parsed
  }

  private parseOptionalTimestamp(value: string | Date | null): Date | null {
    if (value == null || value === '') {
      return null
    }

    return this.parseTimestamp(value, 'dateFinal')
  }

  private parseDecimalString(value: string | number | null): string {
    if (value == null || value === '') {
      return '0'
    }

    return String(value)
  }

  private normalizeOptionalText(value: string | null): string | null {
    if (value == null) {
      return null
    }

    const normalizedValue = value.trim()
    return normalizedValue === '' ? null : normalizedValue
  }

  private hasText(value: string | null): boolean {
    return this.normalizeOptionalText(value) !== null
  }

  private isShortExtension(value: string | null): boolean {
    if (!this.hasText(value)) {
      return false
    }

    return this.shortExtensionPattern.test(String(value).trim())
  }
}
