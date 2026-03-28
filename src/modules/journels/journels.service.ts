import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateJournelDto } from './dto/create-journel.dto';
import { UpdateJournelDto } from './dto/update-journel.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import appConfig from 'src/config/app.config';
import { StringHelper } from 'src/common/helper/string.helper';
import { SojebStorage } from 'src/common/lib/Disk/SojebStorage';
import { SubscriptionManager } from 'src/common/helper/subscription.manager';
import { FirebaseService } from '../firebase/firebase.service';

@Injectable()
export class JournelsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly firebaseService: FirebaseService,
  ) {}

  // ─── Resolve audio URL ────────────────────────────────────────────────────
  private audioUrl(filename: string): string {
    return SojebStorage.url(appConfig().storageUrl.audio + '/' + filename);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CREATE
  // ─────────────────────────────────────────────────────────────────────────

  async create(
    user_id: string,
    createJournelDto: CreateJournelDto,
    audio?: Express.Multer.File,
  ) {
    if (!user_id) {
      return { success: false, message: 'User ID is required' };
    }

    const user = await this.prisma.user.findUnique({ where: { id: user_id } });
    if (!user) return { success: false, message: 'User not found' };

    // if (user.type !== 'admin') {
    //   const checkPermission = await SubscriptionManager(this.prisma, user_id);

    //   if (!checkPermission) {
    //     throw new BadRequestException(
    //       'Subscription information could not be found for this user.',
    //     );
    //   }

    //   if (
    //     checkPermission.subscriptionName === 'free' &&
    //     createJournelDto.type === 'Audio'
    //   ) {
    //     return {
    //       success: false,
    //       message:
    //         'Audio journals are not available on the free plan. Please upgrade your subscription.',
    //     };
    //   }

    //   if (checkPermission.journal_entries !== Infinity) {
    //     const todayCount = await this.prisma.journel.count({
    //       where: {
    //         user_id,
    //         created_at: {
    //           gte: new Date(new Date().setHours(0, 0, 0, 0)),
    //           lte: new Date(new Date().setHours(23, 59, 59, 999)),
    //         },
    //       },
    //     });
    //     if (todayCount >= checkPermission.journal_entries) {
    //       return {
    //         success: false,
    //         message: `Daily journal limit reached. Your plan allows ${checkPermission.journal_entries} entries per day. Please upgrade your subscription to add more.`,
    //       };
    //     }
    //   }
    // }

    let journelData: any = { ...createJournelDto, user_id };

    if (createJournelDto.type === 'Audio') {
      if (!audio) {
        return {
          success: false,
          message: 'An audio file is required for Audio type journals.',
        };
      }
      const fileName = `${StringHelper.randomString()}-${audio.originalname}`;
      await SojebStorage.put(
        appConfig().storageUrl.audio + fileName,
        audio.buffer,
      );
      journelData.audio = fileName;
      delete journelData.body;
    } else if (createJournelDto.type === 'Text') {
      if (audio) {
        return {
          success: false,
          message: 'Text type journals cannot include an audio file.',
        };
      }
      delete journelData.audio;
    } else {
      return {
        success: false,
        message: `Invalid journal type "${createJournelDto.type}". Allowed values: Text, Audio.`,
      };
    }

    const newJournel = await this.prisma.journel.create({ data: journelData });

    if (user.fcm_token) {
      try {
        const isAudio = createJournelDto.type === 'Audio';
        await this.firebaseService.sendToOne(
          user.fcm_token,
          {
            title: 'Journal saved!',
            body: isAudio
              ? 'Your audio journal has been saved successfully.'
              : `Your journal "${createJournelDto.title ?? 'entry'}" has been saved.`,
            data: {
              screen: 'JournalScreen',
              journalId: newJournel.id,
              type: createJournelDto.type,
            },
          },
          {
            receiverId: user_id,
            type: 'journal_created',
            entityId: newJournel.id,
          },
        );
      } catch (err) {
        console.warn(
          `Push notification failed for user ${user_id}: ${err.message}`,
        );
      }
    }

    return {
      success: true,
      message: 'Journal created successfully',
      data: newJournel,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // FIND ALL (paginated)
  // ─────────────────────────────────────────────────────────────────────────

  async findAll(
    userId: string,
    paginationDto: { page?: number; perPage?: number } = {},
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return { success: false, message: 'User not found' };
    }

    const page = Number(paginationDto.page) || 1;
    const perPage = Number(paginationDto.perPage) || 10;
    const skip = (page - 1) * perPage;

    // ✅ Role-based where condition
    const whereClause = user.type === 'admin' ? {} : { user_id: userId };

    // ✅ Total count
    const total = await this.prisma.journel.count({
      where: whereClause,
    });

    // ✅ Fetch journals
    const journals = await this.prisma.journel.findMany({
      where: whereClause,
      skip,
      take: perPage,
      orderBy: { created_at: 'desc' },
      include: {
        _count: { select: { likeJournels: true } },
        user: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            avatar: true,
          },
        },
        likeJournels: {
          where: { userId }, // for isLiked
        },
      },
    });

    if (journals.length === 0) {
      return {
        success: true,
        message: 'No journals found.',
        data: [],
        pagination: {
          total: 0,
          page,
          perPage,
          totalPages: 0,
        },
      };
    }

    const result = journals.map(({ _count, likeJournels, ...journal }) => ({
      ...journal,
      audio: journal.audio ? this.audioUrl(journal.audio) : null,
      likeCount: _count.likeJournels,
      isLiked: likeJournels.length > 0,
      user: {
        ...journal.user,
        name:
          [journal.user.first_name, journal.user.last_name]
            .filter(Boolean)
            .join(' ') || null,
      },
    }));

    return {
      success: true,
      message: 'Journals retrieved successfully',
      data: result,
      pagination: {
        total,
        page,
        perPage,
        totalPages: Math.ceil(total / perPage),
      },
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RECOMMENDED
  // ─────────────────────────────────────────────────────────────────────────

  async getRecommendedJournals(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) return { success: false, message: 'User not found' };

    const journals = await this.prisma.journel.findMany({
      where: { user_id: { not: userId } },
      include: {
        user: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            name: true,
            avatar: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
      take: 10,
    });

    const result = journals.map((journal) => ({
      ...journal,
      audio: journal.audio ? this.audioUrl(journal.audio) : null,
    }));

    return {
      success: true,
      message: 'Recommended journals retrieved successfully',
      data: result,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PERSONAL JOURNALS
  // ─────────────────────────────────────────────────────────────────────────

  async getPersonalJournals(userId: string, searchTerm?: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) return { success: false, message: 'User not found' };

    const journals = await this.prisma.journel.findMany({
      where: {
        user_id: userId,
        // Search across title, body and tags if searchTerm provided
        ...(searchTerm?.trim() && {
          OR: [
            { title: { contains: searchTerm, mode: 'insensitive' } },
            { body: { contains: searchTerm, mode: 'insensitive' } },
            { tags: { has: searchTerm } },
          ],
        }),
      },
      orderBy: { created_at: 'desc' },
      include: { _count: { select: { likeJournels: true } } },
    });

    const result = journals.map(({ _count, ...journal }) => ({
      ...journal,
      audio: journal.audio ? this.audioUrl(journal.audio) : null,
      likeCount: _count.likeJournels,
    }));

    return {
      success: true,
      message: 'Personal journals retrieved successfully',
      data: result,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // FIND ONE
  // ─────────────────────────────────────────────────────────────────────────

  async findOne(user_id: string, id: string) {
    const user = await this.prisma.user.findUnique({ where: { id: user_id } });
    if (!user) return { success: false, message: 'User not found' };

    // BUG FIX: was calling journel.audio on null — crashes if not found
    const journel = await this.prisma.journel.findUnique({
      where: { id, user_id },
    });
    if (!journel)
      return {
        success: false,
        message: 'Journal not found or you do not have access to it.',
      };

    return {
      success: true,
      message: 'Journal retrieved successfully',
      data: {
        ...journel,
        audio: journel.audio ? this.audioUrl(journel.audio) : null,
      },
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TOGGLE LIKE
  // ─────────────────────────────────────────────────────────────────────────

  async toggleLike(userId: string, journelId: string) {
    // BUG FIX: was using try/catch for flow control — any real DB error
    // (connection issue, constraint violation, etc.) was silently swallowed
    // and treated as "unlike", masking the real error entirely

    const journal = await this.prisma.journel.findUnique({
      where: { id: journelId },
    });
    if (!journal) return { success: false, message: 'Journal not found.' };

    const existing = await this.prisma.likeJournel.findUnique({
      where: { userId_journelId: { userId, journelId } },
    });

    if (existing) {
      await this.prisma.likeJournel.delete({
        where: { userId_journelId: { userId, journelId } },
      });
      return {
        success: true,
        message: 'Journal unliked successfully',
        liked: false,
      };
    }

    await this.prisma.likeJournel.create({ data: { userId, journelId } });
    return {
      success: true,
      message: 'Journal liked successfully',
      liked: true,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // UPDATE
  // ─────────────────────────────────────────────────────────────────────────

  async update(
    user_id: string,
    id: string,
    updateJournelDto: UpdateJournelDto,
    audio?: Express.Multer.File,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: user_id } });
    if (!user) return { success: false, message: 'User not found' };

    const journal = await this.prisma.journel.findUnique({ where: { id } });
    // BUG FIX: was returning "Unauthorized" even when journal simply doesn't exist
    if (!journal) return { success: false, message: 'Journal not found.' };
    if (journal.user_id !== user_id)
      return {
        success: false,
        message: 'You are not authorized to update this journal.',
      };

    let updateData: any = { ...updateJournelDto };

    if (updateJournelDto.type === 'Audio') {
      if (!audio && !journal.audio) {
        return {
          success: false,
          message: 'An audio file is required when switching to Audio type.',
        };
      }
      if (audio) {
        if (journal.audio) {
          await SojebStorage.delete(
            appConfig().storageUrl.audio + journal.audio,
          ).catch(() => {});
        }
        const fileName = `${StringHelper.randomString()}-${audio.originalname}`;
        await SojebStorage.put(
          appConfig().storageUrl.audio + fileName,
          audio.buffer,
        );
        updateData.audio = fileName;
      }
      delete updateData.body;
    } else if (updateJournelDto.type === 'Text') {
      if (journal.audio) {
        await SojebStorage.delete(
          appConfig().storageUrl.audio + journal.audio,
        ).catch(() => {});
      }
      updateData.audio = null;
      delete updateData.body;
    } else if (updateJournelDto.type) {
      return {
        success: false,
        message: `Invalid journal type "${updateJournelDto.type}". Allowed values: Text, Audio.`,
      };
    }

    const updatedJournal = await this.prisma.journel.update({
      where: { id },
      data: updateData,
    });

    return {
      success: true,
      message: 'Journal updated successfully',
      data: updatedJournal,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DELETE
  // ─────────────────────────────────────────────────────────────────────────

  async remove(user_id: string, id: string) {
    const user = await this.prisma.user.findUnique({ where: { id: user_id } });
    if (!user) return { success: false, message: 'User not found' };

    const journal = await this.prisma.journel.findUnique({ where: { id } });
    if (!journal) return { success: false, message: 'Journal not found.' };
    if (journal.user_id !== user_id)
      return {
        success: false,
        message: 'You are not authorized to delete this journal.',
      };

    if (journal.audio) {
      await SojebStorage.delete(
        appConfig().storageUrl.audio + journal.audio,
      ).catch(() => {});
    }

    await this.prisma.journel.delete({ where: { id } });

    return { success: true, message: 'Journal deleted successfully' };
  }
}
