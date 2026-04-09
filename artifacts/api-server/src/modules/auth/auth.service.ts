import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthUser, User } from '../../common/models';
import { StoreService } from '../../common/store.service';
import { signToken, JwtPayload } from '../../common/jwt';

@Injectable()
export class AuthService {
  constructor(private readonly store: StoreService) {}

  login(email: string, password: string) {
    const user = this.store.snapshot.users.find(
      (item) => item.email.toLowerCase() === email.toLowerCase() && item.password === password,
    );

    if (!user) {
      throw new UnauthorizedException('Nieprawidlowy email lub haslo');
    }

    const authUser = this.toAuthUser(user);
    const payload: JwtPayload = {
      userId: authUser.id,
      firstName: authUser.fullName.split(' ')[0] || '',
      lastName: authUser.fullName.split(' ').slice(1).join(' ') || '',
      stage: '',
      spaceCode: '',
      role: authUser.role,
    };
    const accessToken = signToken(payload);

    return {
      accessToken,
      user: authUser,
    };
  }

  me(userId: string) {
    const user = this.store.snapshot.users.find((item) => item.id === userId);
    if (!user) {
      throw new UnauthorizedException('Uzytkownik nie znaleziony');
    }
    return this.toAuthUser(user);
  }

  private toAuthUser(user: User): AuthUser {
    return {
      id: user.id,
      tenantId: user.tenantId,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
    };
  }
}
