import { scryptSync, timingSafeEqual } from 'node:crypto'
import { Injectable } from '@nestjs/common'

@Injectable()
export class PasswordHashService {
  verify(password: string, passwordHash: string): boolean {
    const parts = passwordHash.split('$')

    if (parts.length !== 3 || parts[0] !== 'scrypt') {
      return false
    }

    const [, salt, expectedHash] = parts
    const derivedKey = scryptSync(password, salt, 64).toString('hex')

    return timingSafeEqual(Buffer.from(derivedKey, 'hex'), Buffer.from(expectedHash, 'hex'))
  }
}
