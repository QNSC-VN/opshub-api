import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException, ErrorCodes } from '@platform';
import {
  EMPLOYEE_REPOSITORY,
  type IEmployeeRepository,
} from '../domain/ports/employee.repository';
import type { Employee } from '../domain/employee.types';

export interface AuthResult {
  accessToken: string;
  employee: Employee;
}

/**
 * Auth application service.
 *
 * The scaffold ships a dev-login that mints an HS256 JWT for a known employee
 * email — enough to exercise the API and the FE locally. In production this is
 * replaced by the Entra ID OIDC flow (MSAL): the OIDC id_token is validated,
 * the employee resolved/JIT-provisioned by `entraOid`, and the same JWT minted.
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly jwt: JwtService,
    @Inject(EMPLOYEE_REPOSITORY) private readonly employeeRepo: IEmployeeRepository,
  ) {}

  async devLogin(email: string): Promise<AuthResult> {
    const employee = await this.employeeRepo.findByEmail(email.toLowerCase());
    if (!employee) {
      throw new UnauthorizedException(ErrorCodes.AUTH_INVALID_CREDENTIALS, 'Unknown employee');
    }
    if (employee.status === 'offboarded') {
      throw new UnauthorizedException(ErrorCodes.EMPLOYEE_INACTIVE, 'Employee is offboarded');
    }

    const accessToken = await this.jwt.signAsync({
      sub: employee.id,
      email: employee.email,
      name: employee.displayName,
      roles: employee.roles,
    });

    return { accessToken, employee };
  }
}
