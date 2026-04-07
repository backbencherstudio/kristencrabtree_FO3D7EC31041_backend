import { Injectable } from '@nestjs/common';
import { CreateJournelDto } from './dto/create-journel.dto';
import { UpdateJournelDto } from './dto/update-journel.dto';
import { FirebaseService } from '../firebase/firebase.service';
import { PrismaService } from '../../prisma/prisma.service';
import appConfig from '../../config/app.config';
import { SojebStorage } from '../../common/lib/Disk/SojebStorage';
import { StringHelper } from '../../common/helper/string.helper';

@Injectable()
export class JournelsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly firebaseService: FirebaseService,
  ) {}

  // ── Store path only (no base URL) ─────────────────────────────────────────
  private audioPath(filename: string): string {
    return appConfig().storageUrl.audio + filename;
  }

  private photoPath(filename: string): string {
    return appConfig().storageUrl.photo + filename;
  }

  // ── Resolve full URL from stored path ─────────────────────────────────────
  private resolveUrl(path: string): string {
    return SojebStorage.url(path);
  }

  // ── Resolve audio URL ──────────────────────────────────────────────────────
  private resolveAudioUrl(filename: string): string {
    return this.resolveUrl(this.audioPath(filename));
  }

  // ── Resolve photo URL ──────────────────────────────────────────────────────
  private resolvePhotoUrl(filename: string): string {
    return this.resolveUrl(this.photoPath(filename));
  }

  // ── Upload multiple photos, store paths only ───────────────────────────────
  private async uploadPhotos(photos: Express.Multer.File[]): Promise<string[]> {
    const paths: string[] = [];
    for (const photo of photos) {
      const fileName = `${StringHelper.randomString()}-${photo.originalname}`;
      const storagePath = this.photoPath(fileName); // e.g. /journal-photos/abc123-photo.jpg
      await SojebStorage.put(storagePath, photo.buffer);
      paths.push(storagePath); // ✅ store path, not full URL
    }
    return paths;
  }

  // ── Delete photos by stored paths ─────────────────────────────────────────
  private async deletePhotos(paths: string[]): Promise<void> {
    for (const path of paths) {
      await SojebStorage.delete(path).catch(() => {});
    }
  }

  // ── Format journal for response (add full URLs) ────────────────────────────
  private formatJournel(journal: any) {
    return {
      ...journal,
      // stored as filename only → resolve full URL
      audio: journal.audio ? this.resolveAudioUrl(journal.audio) : null,
      // stored as full path → resolve full URL
      photos: (journal.photos || []).map((p: string) => this.resolveUrl(p)),
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CREATE
  // ─────────────────────────────────────────────────────────────────────────
  async create(
    user_id: string,
    createJournelDto: CreateJournelDto,
    audio?: Express.Multer.File,
    photos?: Express.Multer.File[],
  ) {
    if (!user_id) return { success: false, message: 'User ID is required' };

    const user = await this.prisma.user.findUnique({ where: { id: user_id } });
    if (!user) return { success: false, message: 'User not found' };

    let journelData: any = { ...createJournelDto, user_id };

    // ── Audio type ───────────────────────────────────────────────────────────
    if (createJournelDto.type === 'Audio') {
      if (!audio) {
        return {
          success: false,
          message: 'An audio file is required for Audio type journals.',
        };
      }
      const fileName = `${StringHelper.randomString()}-${audio.originalname}`;
      const storagePath = this.audioPath(fileName);
      await SojebStorage.put(storagePath, audio.buffer);
      journelData.audio = fileName; // ✅ store filename only in DB
      delete journelData.body;

      // ── Text type ────────────────────────────────────────────────────────────
    } else if (createJournelDto.type === 'Text') {
      if (audio) {
        return {
          success: false,
          message: 'Text type journals cannot include an audio file.',
        };
      }
      delete journelData.audio;
    } else if (createJournelDto.type === 'Photo') {
      // ── Photos: upload and store full paths in DB ────────────────────────────
      if (!photos || photos.length === 0) {
        return {
          success: false,
          message: 'At least one photo is required for Photo type journals.',
        };
      }

      journelData.photos =
        photos && photos.length > 0
          ? await this.uploadPhotos(photos) // returns ['/journal-photos/filename.jpg', ...]
          : [];
    } else {
      return {
        success: false,
        message: `Invalid journal type "${createJournelDto.type}". Allowed values: Text, Audio, Photo.`,
      };
    }

    const newJournel = await this.prisma.journel.create({ data: journelData });

    // ── Push notification ────────────────────────────────────────────────────
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
          `Push notification failed for user ${user_id}: ${(err as Error).message}`,
        );
      }
    }

    return {
      success: true,
      message: 'Journal created successfully',
      data: this.formatJournel(newJournel),
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // FIND ALL (paginated)
  // ─────────────────────────────────────────────────────────────────────────
  async findAll(
    userId: string,
    paginationDto: { page?: number; perPage?: number } = {},
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) return { success: false, message: 'User not found' };

    const page = Number(paginationDto.page) || 1;
    const perPage = Number(paginationDto.perPage) || 10;
    const skip = (page - 1) * perPage;

    const whereClause = user.type === 'admin' ? {} : { user_id: userId };
    const total = await this.prisma.journel.count({ where: whereClause });

    const journals = await this.prisma.journel.findMany({
      where: whereClause,
      skip,
      take: perPage,
      orderBy: { created_at: 'desc' },
      include: {
        _count: { select: { likeJournels: true } },
        user: {
          select: { id: true, first_name: true, last_name: true, avatar: true },
        },
        likeJournels: { where: { userId } },
      },
    });

    if (journals.length === 0) {
      return {
        success: true,
        message: 'No journals found.',
        data: [],
        pagination: { total: 0, page, perPage, totalPages: 0 },
      };
    }

    const result = journals.map(({ _count, likeJournels, ...journal }) => ({
      ...this.formatJournel(journal),
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

    return {
      success: true,
      message: 'Recommended journals retrieved successfully',
      data: journals.map((j) => this.formatJournel(j)),
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

    return {
      success: true,
      message: 'Personal journals retrieved successfully',
      data: journals.map(({ _count, ...journal }) => ({
        ...this.formatJournel(journal),
        likeCount: _count.likeJournels,
      })),
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // FIND ONE
  // ─────────────────────────────────────────────────────────────────────────
  async findOne(user_id: string, id: string) {
    const user = await this.prisma.user.findUnique({ where: { id: user_id } });
    if (!user) return { success: false, message: 'User not found' };

    const journel = await this.prisma.journel.findUnique({
      where: { id, user_id },
    });
    if (!journel) {
      return {
        success: false,
        message: 'Journal not found or you do not have access to it.',
      };
    }

    return {
      success: true,
      message: 'Journal retrieved successfully',
      data: this.formatJournel(journel),
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TOGGLE LIKE
  // ─────────────────────────────────────────────────────────────────────────
  async toggleLike(userId: string, journelId: string) {
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
    photos?: Express.Multer.File[],
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: user_id } });
    if (!user) return { success: false, message: 'User not found' };

    const journal = await this.prisma.journel.findUnique({ where: { id } });
    if (!journal) return { success: false, message: 'Journal not found.' };
    if (journal.user_id !== user_id) {
      return {
        success: false,
        message: 'You are not authorized to update this journal.',
      };
    }

    const targetType = updateJournelDto.type ?? journal.type;
    let updateData: any = { ...updateJournelDto };

    if (photos && photos.length > 0 && targetType !== 'Photo') {
      return {
        success: false,
        message: 'Photos can only be uploaded for Photo type journals.',
      };
    }

    if (targetType === 'Audio') {
      if (!audio && !journal.audio) {
        return {
          success: false,
          message: 'An audio file is required when switching to Audio type.',
        };
      }
      if (audio) {
        if (journal.audio) {
          await SojebStorage.delete(this.audioPath(journal.audio)).catch(
            () => {},
          );
        }
        const fileName = `${StringHelper.randomString()}-${audio.originalname}`;
        const storagePath = this.audioPath(fileName);
        await SojebStorage.put(storagePath, audio.buffer);
        updateData.audio = fileName;
      }
      if (journal.photos && journal.photos.length > 0) {
        await this.deletePhotos(journal.photos).catch(() => {});
        updateData.photos = [];
      }
      delete updateData.body;
    } else if (targetType === 'Text') {
      if (journal.audio) {
        await SojebStorage.delete(this.audioPath(journal.audio)).catch(
          () => {},
        );
      }
      updateData.audio = null;
      if (journal.photos && journal.photos.length > 0) {
        await this.deletePhotos(journal.photos).catch(() => {});
        updateData.photos = [];
      }
    } else if (targetType === 'Photo') {
      updateData.audio = null;
      if (audio) {
        if (journal.audio) {
          await SojebStorage.delete(this.audioPath(journal.audio)).catch(
            () => {},
          );
        }
      }
      if (photos && photos.length > 0) {
        if (journal.photos && journal.photos.length > 0) {
          await this.deletePhotos(journal.photos).catch(() => {});
        }
        updateData.photos = await this.uploadPhotos(photos);
      } else if (updateJournelDto.type === 'Photo' && !journal.photos?.length) {
        return {
          success: false,
          message:
            'At least one photo is required when switching to Photo type.',
        };
      }
    } else {
      return {
        success: false,
        message: `Invalid journal type "${targetType}". Allowed values: Text, Audio, Photo.`,
      };
    }

    const updatedJournal = await this.prisma.journel.update({
      where: { id },
      data: updateData,
    });

    return {
      success: true,
      message: 'Journal updated successfully',
      data: this.formatJournel(updatedJournal),
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
    if (journal.user_id !== user_id) {
      return {
        success: false,
        message: 'You are not authorized to delete this journal.',
      };
    }

    // Delete audio file
    if (journal.audio) {
      await SojebStorage.delete(this.audioPath(journal.audio)).catch(() => {});
    }

    // Delete all photo files using stored paths
    if (journal.photos && journal.photos.length > 0) {
      await this.deletePhotos(journal.photos);
    }

    await this.prisma.journel.delete({ where: { id } });

    return { success: true, message: 'Journal deleted successfully' };
  }
}
