import type { StaffRole } from '@metrobet/contracts';
import {
  type CanActivate,
  createParamDecorator,
  type ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import { StaffDirectory } from './staff-directory.js';
import { SessionService } from './session.service.js';

export type PlayerPrincipal = { playerId: string; sessionId: string };
export type StaffPrincipal = { staffId: string; sessionId: string; role: StaffRole; email: string };

type AuthRequest = Request & { player?: PlayerPrincipal; staff?: StaffPrincipal };

function bearerToken(request: Request): string {
  const [scheme, token] = (request.header('authorization') ?? '').split(' ');
  if (scheme !== 'Bearer' || !token) throw new UnauthorizedException('Not signed in');
  return token;
}

/** Requires a player session (`Authorization: Bearer <token>`). */
@Injectable()
export class PlayerAuthGuard implements CanActivate {
  constructor(@Inject(SessionService) private readonly sessions: SessionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthRequest>();
    const session = await this.sessions.resolve(bearerToken(request), 'player');
    if (!session) throw new UnauthorizedException('Session expired, please sign in again');
    request.player = { playerId: session.subjectId, sessionId: session.sessionId };
    return true;
  }
}

const ROLES_KEY = 'staff-roles';

/** Staff roles allowed on a controller/route. `admin` is always allowed. */
export const Roles = (...roles: StaffRole[]) => SetMetadata(ROLES_KEY, roles);

/** Requires an active staff session; enforces @Roles(). */
@Injectable()
export class StaffAuthGuard implements CanActivate {
  constructor(
    @Inject(SessionService) private readonly sessions: SessionService,
    @Inject(StaffDirectory) private readonly staff: StaffDirectory,
    @Inject(Reflector) private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthRequest>();
    const session = await this.sessions.resolve(bearerToken(request), 'staff');
    if (!session) throw new UnauthorizedException('Session expired, please sign in again');

    const member = await this.staff.findActive(session.subjectId);
    if (!member) throw new UnauthorizedException('Account disabled');

    const allowed = this.reflector.getAllAndOverride<StaffRole[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (allowed && member.role !== 'admin' && !allowed.includes(member.role)) {
      throw new ForbiddenException('Your role cannot do this');
    }
    request.staff = {
      staffId: member.id,
      sessionId: session.sessionId,
      role: member.role,
      email: member.email,
    };
    return true;
  }
}

export const CurrentPlayer = createParamDecorator(
  (_: unknown, context: ExecutionContext): PlayerPrincipal => {
    const player = context.switchToHttp().getRequest<AuthRequest>().player;
    if (!player) throw new UnauthorizedException();
    return player;
  },
);

export const CurrentStaff = createParamDecorator(
  (_: unknown, context: ExecutionContext): StaffPrincipal => {
    const staff = context.switchToHttp().getRequest<AuthRequest>().staff;
    if (!staff) throw new UnauthorizedException();
    return staff;
  },
);

/** Audit actor id for a staff member. */
export const staffActor = (staff: StaffPrincipal) => `staff:${staff.staffId}`;

/** Client metadata stored with new sessions. */
export const sessionMeta = (request: Request) => ({
  ip: request.ip ?? null,
  userAgent: request.header('user-agent') ?? null,
});
