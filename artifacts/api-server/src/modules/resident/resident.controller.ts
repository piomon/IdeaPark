import { Controller, Get, Post, Delete, Put, Body, Param, Query, HttpCode, UseGuards, Req } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ResidentService } from './resident.service';
import { Public } from '../../common/auth.guard';
import { JwtPayload } from '../../common/jwt';
import { Request } from 'express';

@Controller('resident')
export class ResidentController {
  constructor(private readonly svc: ResidentService) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  async login(@Body() body: { firstName: string; lastName: string; password: string }) {
    return this.svc.login(body.firstName, body.lastName, body.password);
  }

  @Public()
  @Post('register')
  async register(@Body() body: {
    firstName: string; lastName: string; password: string; city: string; street: string;
    building: string; apartment: string; spaceCode: string;
    parkingType: string; stage: string; phone: string; plateNumber?: string;
  }) {
    return this.svc.register(body);
  }

  @Public()
  @Get('demo-users')
  async getDemoUsers() {
    return this.svc.getDemoUsers();
  }

  @Get('sharing')
  async getSharing(@Query('stage') stage?: string) {
    return this.svc.getSharing(stage);
  }

  @Get('seeking')
  async getSeeking() {
    return this.svc.getSeeking();
  }

  @Post('sharing')
  async addSharing(@Req() req: Request, @Body() body: { from: string; to: string }) {
    const user = req.user as JwtPayload;
    return this.svc.addSharing(user.userId, body.from, body.to);
  }

  @Post('seeking')
  async addSeeking(@Req() req: Request, @Body() body: { from: string; to: string }) {
    const user = req.user as JwtPayload;
    return this.svc.addSeeking(user.userId, body.from, body.to);
  }

  @Delete('sharing/:id')
  async deleteSharing(@Param('id') id: string, @Req() req: Request) {
    const user = req.user as JwtPayload;
    return this.svc.deleteSharing(id, user.userId);
  }

  @Put('sharing/:id')
  async editSharing(@Param('id') id: string, @Req() req: Request, @Body() body: { from: string; to: string }) {
    const user = req.user as JwtPayload;
    return this.svc.editSharing(id, user.userId, body.from, body.to);
  }

  @Delete('seeking/:id')
  async deleteSeeking(@Param('id') id: string, @Req() req: Request) {
    const user = req.user as JwtPayload;
    return this.svc.deleteSeeking(id, user.userId);
  }

  @Put('seeking/:id')
  async editSeeking(@Param('id') id: string, @Req() req: Request, @Body() body: { from: string; to: string }) {
    const user = req.user as JwtPayload;
    return this.svc.editSeeking(id, user.userId, body.from, body.to);
  }

  @Post('sharing/:id/request')
  async requestSpace(@Param('id') id: string, @Req() req: Request) {
    const user = req.user as JwtPayload;
    return this.svc.requestSpace(id, user.userId);
  }

  @Post('sharing/:id/accept')
  async acceptRequest(@Param('id') id: string, @Req() req: Request) {
    const user = req.user as JwtPayload;
    return this.svc.acceptRequest(id, user.userId);
  }

  @Post('sharing/:id/reject')
  async rejectRequest(@Param('id') id: string, @Req() req: Request) {
    const user = req.user as JwtPayload;
    return this.svc.rejectRequest(id, user.userId);
  }

  @Post('seeking/:id/propose')
  async addProposal(@Param('id') id: string, @Req() req: Request) {
    const user = req.user as JwtPayload;
    return this.svc.addProposal(id, user.userId);
  }

  @Post('seeking/:id/accept-proposal')
  async acceptProposal(@Param('id') id: string, @Req() req: Request, @Body() body: { proposalId: string }) {
    const user = req.user as JwtPayload;
    return this.svc.acceptProposal(id, body.proposalId, user.userId);
  }

  @Post('seeking/:id/reject-proposal')
  async rejectProposal(@Param('id') id: string, @Req() req: Request, @Body() body: { proposalId: string }) {
    const user = req.user as JwtPayload;
    return this.svc.rejectProposal(id, body.proposalId, user.userId);
  }

  @Post('sharing/:id/confirm-vacated')
  async confirmVacated(@Param('id') id: string, @Req() req: Request) {
    const user = req.user as JwtPayload;
    return this.svc.confirmVacated(id, user.userId);
  }

  @Get('active-reservations')
  async getActiveReservations(@Req() req: Request) {
    const user = req.user as JwtPayload;
    return this.svc.getActiveReservations(user.userId);
  }

  @Get('chats')
  async getChats(@Req() req: Request) {
    const user = req.user as JwtPayload;
    return this.svc.getChats(user.userId);
  }

  @Post('chats')
  async getOrCreateChat(@Req() req: Request, @Body() body: { otherUserId: string; spaceCode: string; reservationId: string }) {
    const user = req.user as JwtPayload;
    return this.svc.getOrCreateChat(user.userId, body.otherUserId, body.spaceCode, body.reservationId);
  }

  @Post('chats/:threadId/messages')
  async sendMessage(@Param('threadId') threadId: string, @Req() req: Request, @Body() body: { text: string }) {
    const user = req.user as JwtPayload;
    return this.svc.sendMessage(threadId, user.userId, body.text);
  }

  @Get('notifications')
  async getNotifications(@Req() req: Request) {
    const user = req.user as JwtPayload;
    return this.svc.getNotifications(user.userId);
  }

  @Post('notifications')
  async addNotification(@Req() req: Request, @Body() body: { type: string; title: string; body: string; spaceCode?: string; relatedId?: string }) {
    const user = req.user as JwtPayload;
    return this.svc.addNotification(user.userId, body);
  }

  @Post('notifications/read')
  async markRead(@Req() req: Request) {
    const user = req.user as JwtPayload;
    return this.svc.markNotificationsRead(user.userId);
  }
}
