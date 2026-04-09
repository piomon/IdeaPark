import { Injectable, BadRequestException, NotFoundException, ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { query } from '../../common/db';
import { signToken, JwtPayload } from '../../common/jwt';

const SALT_ROUNDS = 12;
const DEMO_PASSWORD = 'IdeaPark2026!';

@Injectable()
export class ResidentService {

  async login(firstName: string, lastName: string, password: string) {
    if (!firstName?.trim() || !lastName?.trim() || !password) {
      throw new BadRequestException('All fields are required');
    }

    const { rows } = await query(
      'SELECT * FROM residents WHERE LOWER(first_name)=LOWER($1) AND LOWER(last_name)=LOWER($2)',
      [firstName.trim(), lastName.trim()]
    );
    if (rows.length === 0) throw new UnauthorizedException('Invalid credentials');

    const user = rows[0];

    if (!user.password_hash) {
      const hash = await bcrypt.hash(DEMO_PASSWORD, SALT_ROUNDS);
      await query('UPDATE residents SET password_hash=$1 WHERE id=$2', [hash, user.id]);
      user.password_hash = hash;
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    const payload: JwtPayload = {
      userId: user.id,
      firstName: user.first_name,
      lastName: user.last_name,
      stage: user.stage,
      spaceCode: user.space_code,
      role: user.role,
    };
    const token = signToken(payload);

    return {
      token,
      user: this.mapResident(user),
    };
  }

  async register(data: {
    firstName: string; lastName: string; password: string; city: string; street: string;
    building: string; apartment: string; spaceCode: string;
    parkingType: string; stage: string; phone: string; plateNumber?: string;
  }) {
    if (!data.password || data.password.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters');
    }

    const { rows: existing } = await query(
      'SELECT id FROM residents WHERE LOWER(first_name)=LOWER($1) AND LOWER(last_name)=LOWER($2)',
      [data.firstName.trim(), data.lastName.trim()]
    );
    if (existing.length > 0) throw new ConflictException('User already exists');

    const { rows: spaceExists } = await query(
      'SELECT id FROM residents WHERE LOWER(space_code)=LOWER($1)',
      [data.spaceCode.trim()]
    );
    if (spaceExists.length > 0) throw new ConflictException('Space code already registered');

    const passwordHash = await bcrypt.hash(data.password, SALT_ROUNDS);
    const id = `user_${Date.now()}`;
    await query(
      `INSERT INTO residents (id, first_name, last_name, password_hash, city, street, building, apartment, space_code, parking_type, stage, phone, plate_number)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [id, data.firstName.trim(), data.lastName.trim(), passwordHash, data.city.trim(), data.street.trim(),
       data.building.trim(), data.apartment.trim(), data.spaceCode.trim().toUpperCase(),
       data.parkingType, data.stage, data.phone, data.plateNumber?.trim().toUpperCase() || null]
    );
    const { rows } = await query('SELECT * FROM residents WHERE id=$1', [id]);

    const payload: JwtPayload = {
      userId: rows[0].id,
      firstName: rows[0].first_name,
      lastName: rows[0].last_name,
      stage: rows[0].stage,
      spaceCode: rows[0].space_code,
      role: rows[0].role,
    };
    const token = signToken(payload);

    return {
      token,
      user: this.mapResident(rows[0]),
    };
  }

  async getDemoUsers() {
    const { rows } = await query("SELECT * FROM residents WHERE id LIKE 'user_%' ORDER BY created_at");
    return rows.map((r: any) => this.mapResident(r));
  }

  async getSharing(stage?: string) {
    let sql = `
      SELECT se.*, r.first_name, r.last_name, r.apartment, r.plate_number
      FROM sharing_entries se
      JOIN residents r ON r.id = se.user_id
    `;
    const params: any[] = [];
    if (stage) {
      sql += ' WHERE se.stage=$1';
      params.push(stage);
    }
    sql += ' ORDER BY se.posted_at DESC';
    const { rows } = await query(sql, params);
    const sharingList = [];
    for (const r of rows) {
      let borrowerPlate = null;
      if (r.requested_by_user_id) {
        const { rows: bRows } = await query('SELECT plate_number FROM residents WHERE id=$1', [r.requested_by_user_id]);
        if (bRows.length > 0) borrowerPlate = bRows[0].plate_number;
      }
      sharingList.push({
        id: r.id,
        userId: r.user_id,
        ownerName: `${r.first_name} ${r.last_name}`,
        ownerPlate: r.plate_number,
        apartment: r.apartment,
        spaceCode: r.space_code,
        parkingType: r.parking_type,
        stage: r.stage,
        dateFrom: r.date_from,
        dateTo: r.date_to,
        status: r.status,
        requestedByUserId: r.requested_by_user_id,
        borrowerPlate,
        vacatedAt: r.vacated_at,
        postedAt: r.posted_at,
      });
    }
    return sharingList;
  }

  async getSeeking() {
    const { rows } = await query(`
      SELECT se.*, r.first_name, r.last_name
      FROM seeking_entries se
      JOIN residents r ON r.id = se.user_id
      ORDER BY se.posted_at DESC
    `);

    const seekingList = [];
    for (const r of rows) {
      const { rows: proposals } = await query(`
        SELECT p.*, res.first_name, res.last_name, res.apartment
        FROM proposals p
        JOIN residents res ON res.id = p.from_user_id
        WHERE p.seeking_id=$1
        ORDER BY p.created_at
      `, [r.id]);

      seekingList.push({
        id: r.id,
        userId: r.user_id,
        seekerName: `${r.first_name} ${r.last_name}`,
        stage: r.stage,
        dateFrom: r.date_from,
        dateTo: r.date_to,
        status: r.status,
        matchedSpaceCode: r.matched_space_code,
        matchedOwnerId: r.matched_owner_id,
        matchedParkingType: r.matched_parking_type,
        postedAt: r.posted_at,
        proposals: proposals.map((p: any) => ({
          id: p.id,
          fromUserId: p.from_user_id,
          fromUserName: `${p.first_name} ${p.last_name}`,
          apartment: p.apartment,
          spaceCode: p.space_code,
          parkingType: p.parking_type,
          stage: p.stage,
          createdAt: p.created_at,
        })),
      });
    }
    return seekingList;
  }

  async addSharing(userId: string, from: string, to: string) {
    const user = await this.getResident(userId);

    const dateFrom = new Date(from);
    const dateTo = new Date(to);
    if (isNaN(dateFrom.getTime()) || isNaN(dateTo.getTime())) throw new BadRequestException('Invalid date format');
    if (dateTo <= dateFrom) throw new BadRequestException('End time must be after start time');

    const { rows: overlap } = await query(`
      SELECT id FROM sharing_entries
      WHERE user_id=$1 AND status IN ('available','pending','confirmed')
        AND date_from < $3 AND date_to > $2
    `, [userId, dateFrom.toISOString(), dateTo.toISOString()]);
    if (overlap.length > 0) throw new ConflictException('Overlapping dates');

    const id = `sh_${Date.now()}`;
    await query(
      `INSERT INTO sharing_entries (id, user_id, space_code, parking_type, stage, date_from, date_to)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [id, userId, user.spaceCode, user.parkingType, user.stage, dateFrom.toISOString(), dateTo.toISOString()]
    );
    return { id };
  }

  async addSeeking(userId: string, from: string, to: string) {
    const user = await this.getResident(userId);

    const dateFrom = new Date(from);
    const dateTo = new Date(to);
    if (isNaN(dateFrom.getTime()) || isNaN(dateTo.getTime())) throw new BadRequestException('Invalid date format');
    if (dateTo <= dateFrom) throw new BadRequestException('End time must be after start time');

    const { rows: overlap } = await query(`
      SELECT id FROM seeking_entries
      WHERE user_id=$1 AND status IN ('open','has_proposal')
        AND date_from < $3 AND date_to > $2
    `, [userId, dateFrom.toISOString(), dateTo.toISOString()]);
    if (overlap.length > 0) throw new ConflictException('Overlapping dates');

    const id = `sk_${Date.now()}`;
    await query(
      `INSERT INTO seeking_entries (id, user_id, stage, date_from, date_to)
       VALUES ($1,$2,$3,$4,$5)`,
      [id, userId, user.stage, dateFrom.toISOString(), dateTo.toISOString()]
    );
    return { id };
  }

  async deleteSharing(sharingId: string, userId: string) {
    const { rows: [entry] } = await query('SELECT * FROM sharing_entries WHERE id=$1', [sharingId]);
    if (!entry) throw new NotFoundException('Listing not found');
    if (entry.user_id !== userId) throw new BadRequestException('Only the owner can delete this listing');
    if (entry.status !== 'available') throw new BadRequestException('Cannot delete listing that is already reserved or pending');
    await query('DELETE FROM sharing_entries WHERE id=$1', [sharingId]);
    return { success: true };
  }

  async editSharing(sharingId: string, userId: string, from: string, to: string) {
    const { rows: [entry] } = await query('SELECT * FROM sharing_entries WHERE id=$1', [sharingId]);
    if (!entry) throw new NotFoundException('Listing not found');
    if (entry.user_id !== userId) throw new BadRequestException('Only the owner can edit this listing');
    if (entry.status !== 'available') throw new BadRequestException('Cannot edit listing that is already reserved or pending');

    const dateFrom = new Date(from);
    const dateTo = new Date(to);
    if (isNaN(dateFrom.getTime()) || isNaN(dateTo.getTime())) throw new BadRequestException('Invalid date format');
    if (dateTo <= dateFrom) throw new BadRequestException('End time must be after start time');

    const { rows: overlap } = await query(`
      SELECT id FROM sharing_entries
      WHERE user_id=$1 AND id!=$4 AND status IN ('available','pending','confirmed')
        AND date_from < $3 AND date_to > $2
    `, [userId, dateFrom.toISOString(), dateTo.toISOString(), sharingId]);
    if (overlap.length > 0) throw new ConflictException('Overlapping dates');

    await query('UPDATE sharing_entries SET date_from=$1, date_to=$2 WHERE id=$3', [dateFrom.toISOString(), dateTo.toISOString(), sharingId]);
    return { success: true };
  }

  async deleteSeeking(seekingId: string, userId: string) {
    const { rows: [entry] } = await query('SELECT * FROM seeking_entries WHERE id=$1', [seekingId]);
    if (!entry) throw new NotFoundException('Listing not found');
    if (entry.user_id !== userId) throw new BadRequestException('Only the owner can delete this listing');
    if (entry.status === 'matched') throw new BadRequestException('Cannot delete matched listing');
    await query('DELETE FROM proposals WHERE seeking_id=$1', [seekingId]);
    await query('DELETE FROM seeking_entries WHERE id=$1', [seekingId]);
    return { success: true };
  }

  async editSeeking(seekingId: string, userId: string, from: string, to: string) {
    const { rows: [entry] } = await query('SELECT * FROM seeking_entries WHERE id=$1', [seekingId]);
    if (!entry) throw new NotFoundException('Listing not found');
    if (entry.user_id !== userId) throw new BadRequestException('Only the owner can edit this listing');
    if (entry.status === 'matched') throw new BadRequestException('Cannot edit matched listing');

    const dateFrom = new Date(from);
    const dateTo = new Date(to);
    if (isNaN(dateFrom.getTime()) || isNaN(dateTo.getTime())) throw new BadRequestException('Invalid date format');
    if (dateTo <= dateFrom) throw new BadRequestException('End time must be after start time');

    const { rows: overlap } = await query(`
      SELECT id FROM seeking_entries
      WHERE user_id=$1 AND id!=$4 AND status IN ('open','has_proposal')
        AND date_from < $3 AND date_to > $2
    `, [userId, dateFrom.toISOString(), dateTo.toISOString(), seekingId]);
    if (overlap.length > 0) throw new ConflictException('Overlapping dates');

    await query('UPDATE seeking_entries SET date_from=$1, date_to=$2 WHERE id=$3', [dateFrom.toISOString(), dateTo.toISOString(), seekingId]);
    if (entry.status === 'has_proposal') {
      await query('DELETE FROM proposals WHERE seeking_id=$1', [seekingId]);
      await query("UPDATE seeking_entries SET status='open' WHERE id=$1", [seekingId]);
    }
    return { success: true };
  }

  async requestSpace(sharingId: string, userId: string) {
    const { rows: [target] } = await query('SELECT * FROM sharing_entries WHERE id=$1', [sharingId]);
    if (!target) throw new NotFoundException('Listing not found');
    if (target.status !== 'available') throw new BadRequestException('Not available');
    if (target.user_id === userId) throw new BadRequestException('Cannot reserve own space');

    const user = await this.getResident(userId);
    if (user.stage !== target.stage) throw new BadRequestException('Different stage');

    const { rows: active } = await query(
      `SELECT id FROM sharing_entries WHERE requested_by_user_id=$1 AND status IN ('pending','confirmed')`,
      [userId]
    );
    if (active.length > 0) throw new ConflictException('Already have active reservation');

    await query(
      `UPDATE sharing_entries SET status='pending', requested_by_user_id=$1 WHERE id=$2`,
      [userId, sharingId]
    );
    return { success: true };
  }

  async acceptRequest(sharingId: string, ownerId: string) {
    const { rows: [target] } = await query('SELECT * FROM sharing_entries WHERE id=$1', [sharingId]);
    if (!target) throw new NotFoundException('Not found');
    if (target.status !== 'pending' || target.user_id !== ownerId || !target.requested_by_user_id)
      throw new BadRequestException('Invalid state');

    await query(`UPDATE sharing_entries SET status='confirmed' WHERE id=$1`, [sharingId]);

    await query(`
      UPDATE seeking_entries SET status='matched', matched_space_code=$1, matched_owner_id=$2, matched_parking_type=$3
      WHERE user_id=$4 AND status IN ('open','has_proposal') AND stage=$5
        AND date_from < $7 AND date_to > $6
    `, [target.space_code, ownerId, target.parking_type, target.requested_by_user_id,
        target.stage, target.date_from, target.date_to]);

    return { success: true, requestedByUserId: target.requested_by_user_id };
  }

  async rejectRequest(sharingId: string, ownerId: string) {
    const { rows: [target] } = await query('SELECT * FROM sharing_entries WHERE id=$1', [sharingId]);
    if (!target || target.status !== 'pending' || target.user_id !== ownerId)
      throw new BadRequestException('Invalid');

    await query(`UPDATE sharing_entries SET status='available', requested_by_user_id=NULL WHERE id=$1`, [sharingId]);
    return { success: true };
  }

  async addProposal(seekingId: string, userId: string) {
    const { rows: [target] } = await query('SELECT * FROM seeking_entries WHERE id=$1', [seekingId]);
    if (!target) throw new NotFoundException('Not found');
    if (target.status === 'matched') throw new BadRequestException('Already matched');
    if (target.user_id === userId) throw new BadRequestException('Cannot propose to own listing');

    const user = await this.getResident(userId);
    if (user.stage !== target.stage) throw new BadRequestException('Different stage');

    const { rows: dup } = await query(
      'SELECT id FROM proposals WHERE seeking_id=$1 AND from_user_id=$2', [seekingId, userId]
    );
    if (dup.length > 0) throw new ConflictException('Already proposed');

    const id = `p_${Date.now()}`;
    await query(
      `INSERT INTO proposals (id, seeking_id, from_user_id, space_code, parking_type, stage)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [id, seekingId, userId, user.spaceCode, user.parkingType, user.stage]
    );
    await query(`UPDATE seeking_entries SET status='has_proposal' WHERE id=$1`, [seekingId]);
    return { id };
  }

  async acceptProposal(seekingId: string, proposalId: string, ownerId: string) {
    const { rows: [target] } = await query('SELECT * FROM seeking_entries WHERE id=$1', [seekingId]);
    if (!target || target.user_id !== ownerId || target.status === 'matched')
      throw new BadRequestException('Invalid');

    const { rows: [proposal] } = await query('SELECT * FROM proposals WHERE id=$1', [proposalId]);
    if (!proposal) throw new NotFoundException('Proposal not found');

    const { rows: [shareEntry] } = await query(
      `SELECT * FROM sharing_entries WHERE space_code=$1 AND user_id=$2 AND status='available'`,
      [proposal.space_code, proposal.from_user_id]
    );

    if (!shareEntry) throw new BadRequestException('Space no longer available');

    await query(`
      UPDATE seeking_entries SET status='matched', matched_space_code=$1, matched_owner_id=$2, matched_parking_type=$3
      WHERE id=$4
    `, [proposal.space_code, proposal.from_user_id, proposal.parking_type, seekingId]);

    await query(`UPDATE sharing_entries SET status='confirmed', requested_by_user_id=$1 WHERE id=$2`,
      [ownerId, shareEntry.id]);

    await query('DELETE FROM proposals WHERE seeking_id=$1', [seekingId]);

    return { success: true, fromUserId: proposal.from_user_id, spaceCode: proposal.space_code };
  }

  async rejectProposal(seekingId: string, proposalId: string, ownerId: string) {
    const { rows: [target] } = await query('SELECT * FROM seeking_entries WHERE id=$1', [seekingId]);
    if (!target || target.user_id !== ownerId) throw new BadRequestException('Invalid');

    await query('DELETE FROM proposals WHERE id=$1 AND seeking_id=$2', [proposalId, seekingId]);

    const { rows: remaining } = await query('SELECT id FROM proposals WHERE seeking_id=$1', [seekingId]);
    if (remaining.length === 0) {
      await query(`UPDATE seeking_entries SET status='open' WHERE id=$1 AND status='has_proposal'`, [seekingId]);
    }
    return { success: true };
  }

  async getChats(userId: string) {
    const { rows } = await query(`
      SELECT ct.*,
        ua.first_name as a_first, ua.last_name as a_last,
        ub.first_name as b_first, ub.last_name as b_last
      FROM chat_threads ct
      JOIN residents ua ON ua.id = ct.user_a
      JOIN residents ub ON ub.id = ct.user_b
      WHERE ct.user_a=$1 OR ct.user_b=$1
      ORDER BY ct.created_at DESC
    `, [userId]);

    const threads = [];
    for (const r of rows) {
      const { rows: msgs } = await query(
        'SELECT * FROM chat_messages WHERE thread_id=$1 ORDER BY created_at', [r.id]
      );
      threads.push({
        id: r.id,
        spaceCode: r.space_code,
        userA: r.user_a,
        userB: r.user_b,
        userAName: r.user_a === userId ? `${r.a_first} ${r.a_last}` : `${r.a_first} ${(r.a_last || '')[0] || ''}.`,
        userBName: r.user_b === userId ? `${r.b_first} ${r.b_last}` : `${r.b_first} ${(r.b_last || '')[0] || ''}.`,
        relatedReservationId: r.related_reservation_id,
        messages: msgs.map((m: any) => ({
          id: m.id, fromUserId: m.from_user_id, text: m.text, createdAt: m.created_at,
        })),
      });
    }
    return threads;
  }

  async getOrCreateChat(userId: string, otherUserId: string, spaceCode: string, reservationId: string) {
    const { rows } = await query(`
      SELECT id FROM chat_threads
      WHERE space_code=$1 AND ((user_a=$2 AND user_b=$3) OR (user_a=$3 AND user_b=$2))
    `, [spaceCode, userId, otherUserId]);

    if (rows.length > 0) return { id: rows[0].id };

    const id = `chat_${Date.now()}`;
    await query(
      `INSERT INTO chat_threads (id, space_code, user_a, user_b, related_reservation_id)
       VALUES ($1,$2,$3,$4,$5)`,
      [id, spaceCode, userId, otherUserId, reservationId]
    );
    return { id };
  }

  async sendMessage(threadId: string, userId: string, text: string) {
    if (!text?.trim()) throw new BadRequestException('Message cannot be empty');

    const { rows: [thread] } = await query('SELECT * FROM chat_threads WHERE id=$1', [threadId]);
    if (!thread) throw new NotFoundException('Chat not found');
    if (thread.user_a !== userId && thread.user_b !== userId) throw new BadRequestException('Not authorized');

    const id = `msg_${Date.now()}`;
    await query(
      'INSERT INTO chat_messages (id, thread_id, from_user_id, text) VALUES ($1,$2,$3,$4)',
      [id, threadId, userId, text.trim()]
    );
    return { id };
  }

  async getNotifications(userId: string) {
    const { rows } = await query(
      'SELECT * FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50',
      [userId]
    );
    return rows.map((r: any) => ({
      id: r.id, type: r.type, title: r.title, body: r.body,
      spaceCode: r.space_code, createdAt: r.created_at,
      read: r.read, relatedId: r.related_id,
    }));
  }

  async addNotification(userId: string, data: { type: string; title: string; body: string; spaceCode?: string; relatedId?: string }) {
    const id = `notif_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    await query(
      `INSERT INTO notifications (id, user_id, type, title, body, space_code, related_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [id, userId, data.type, data.title, data.body, data.spaceCode || null, data.relatedId || null]
    );
    return { id };
  }

  async markNotificationsRead(userId: string) {
    await query('UPDATE notifications SET read=TRUE WHERE user_id=$1', [userId]);
    return { success: true };
  }

  async reportVehicleStillParked(sharingId: string, ownerId: string) {
    const { rows: [entry] } = await query('SELECT * FROM sharing_entries WHERE id=$1', [sharingId]);
    if (!entry) throw new NotFoundException('Entry not found');
    if (entry.user_id !== ownerId) throw new BadRequestException('Only the space owner can report');
    if (entry.status !== 'confirmed') throw new BadRequestException('Reservation not active');

    const borrowerId = entry.requested_by_user_id;
    if (!borrowerId) throw new BadRequestException('No borrower to notify');

    const { rows: [owner] } = await query('SELECT first_name, last_name FROM residents WHERE id=$1', [ownerId]);
    const ownerName = `${owner.first_name} ${owner.last_name[0]}.`;

    const id = `notif_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    await query(
      `INSERT INTO notifications (id, user_id, type, title, body, space_code, related_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [id, borrowerId, 'vehicle_report',
       '🚨 Zgłoszenie: pojazd nadal na miejscu!',
       `Właściciel miejsca ${entry.space_code} (${ownerName}) zgłasza, że Twój pojazd nadal stoi na jego miejscu parkingowym. Proszę o jak najszybsze opuszczenie miejsca.`,
       entry.space_code, sharingId]
    );

    return { success: true };
  }

  async getArchive(userId: string) {
    const { rows: sharingRows } = await query(`
      SELECT se.*, r.first_name AS owner_first, r.last_name AS owner_last,
             br.first_name AS borrower_first, br.last_name AS borrower_last, br.plate_number AS borrower_plate
      FROM sharing_entries se
      JOIN residents r ON r.id = se.user_id
      LEFT JOIN residents br ON br.id = se.requested_by_user_id
      WHERE (se.user_id = $1 OR se.requested_by_user_id = $1)
        AND (se.status = 'completed' OR (se.status = 'confirmed' AND se.vacated_at IS NOT NULL)
             OR (se.date_to < NOW() AND se.status IN ('available', 'confirmed', 'completed')))
      ORDER BY se.date_to DESC
      LIMIT 100
    `, [userId]);

    const { rows: seekingRows } = await query(`
      SELECT se.*, r.first_name, r.last_name
      FROM seeking_entries se
      JOIN residents r ON r.id = se.user_id
      WHERE se.user_id = $1
        AND (se.status = 'matched' OR se.date_to < NOW())
      ORDER BY se.date_to DESC
      LIMIT 100
    `, [userId]);

    return {
      sharing: sharingRows.map((r: any) => ({
        id: r.id,
        spaceCode: r.space_code,
        parkingType: r.parking_type,
        stage: r.stage,
        dateFrom: r.date_from,
        dateTo: r.date_to,
        status: r.status,
        ownerName: `${r.owner_first} ${r.owner_last}`,
        ownerId: r.user_id,
        borrowerName: r.borrower_first ? `${r.borrower_first} ${r.borrower_last}` : null,
        borrowerId: r.requested_by_user_id,
        borrowerPlate: r.borrower_plate,
        vacatedAt: r.vacated_at,
        postedAt: r.posted_at,
        role: r.user_id === userId ? 'owner' : 'borrower',
      })),
      seeking: seekingRows.map((r: any) => ({
        id: r.id,
        stage: r.stage,
        dateFrom: r.date_from,
        dateTo: r.date_to,
        status: r.status,
        matchedSpaceCode: r.matched_space_code,
        matchedParkingType: r.matched_parking_type,
        seekerName: `${r.first_name} ${r.last_name}`,
        postedAt: r.posted_at,
      })),
    };
  }

  private async getResident(id: string) {
    const { rows } = await query('SELECT * FROM residents WHERE id=$1', [id]);
    if (rows.length === 0) throw new NotFoundException('Resident not found');
    return this.mapResident(rows[0]);
  }

  async confirmVacated(sharingId: string, userId: string) {
    const { rows: [entry] } = await query('SELECT * FROM sharing_entries WHERE id=$1', [sharingId]);
    if (!entry) throw new NotFoundException('Entry not found');

    if (entry.requested_by_user_id !== userId && entry.user_id !== userId)
      throw new BadRequestException('Not authorized');
    if (entry.status !== 'confirmed')
      throw new BadRequestException('Reservation not confirmed');
    if (entry.vacated_at)
      throw new BadRequestException('Already confirmed as vacated');

    await query('UPDATE sharing_entries SET vacated_at=NOW(), status=$2 WHERE id=$1', [sharingId, 'completed']);
    return { success: true };
  }

  async getActiveReservations(userId: string) {
    const { rows } = await query(`
      SELECT se.*, r.first_name, r.last_name, r.plate_number,
             own.first_name AS owner_first, own.last_name AS owner_last
      FROM sharing_entries se
      JOIN residents r ON r.id = se.requested_by_user_id
      JOIN residents own ON own.id = se.user_id
      WHERE se.status = 'confirmed' AND (se.user_id = $1 OR se.requested_by_user_id = $1)
    `, [userId]);
    return rows.map((r: any) => ({
      id: r.id,
      spaceCode: r.space_code,
      parkingType: r.parking_type,
      stage: r.stage,
      dateFrom: r.date_from,
      dateTo: r.date_to,
      ownerId: r.user_id,
      ownerName: `${r.owner_first} ${r.owner_last}`,
      borrowerId: r.requested_by_user_id,
      borrowerName: `${r.first_name} ${r.last_name}`,
      borrowerPlate: r.plate_number,
      vacatedAt: r.vacated_at,
    }));
  }

  private mapResident(r: any) {
    return {
      id: r.id,
      firstName: r.first_name,
      lastName: r.last_name,
      city: r.city,
      street: r.street,
      building: r.building,
      apartment: r.apartment,
      spaceCode: r.space_code,
      parkingType: r.parking_type,
      stage: r.stage,
      phone: r.phone,
      plateNumber: r.plate_number,
      role: r.role,
    };
  }
}
