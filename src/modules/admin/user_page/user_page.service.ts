import { Injectable } from '@nestjs/common';
import { CreateUserPageDto } from './dto/create-user_page.dto';
import { UpdateUserPageDto } from './dto/update-user_page.dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class UserPageService {

  constructor(private prisma: PrismaService) {}
  create(createUserPageDto: CreateUserPageDto) {
    return 'This action adds a new userPage';
  }

  async findAll(user_id?: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: user_id , type: 'admin' },
      });
      if(!user){
        return {success: false, message: 'Access denied. Admins only.'};
      }

      if (user.type !== 'admin') {
        return {success: false, message: 'Access denied. Admins only.'};
      }

      const getAllUsers = await this.prisma.user.findMany(
        {
          where: {type: 'user'},
          select:{
            name: true,
            first_name: true,
            last_name: true,
            username: true,
            email: true,
            created_at: true,
            status: true,
            type: true
          }
        }
      );

      if (!getAllUsers) {
        return { success: false, message: 'No users found.' };
      }

    return {
      success: true,
      message: 'Users retrieved successfully.',
      data: getAllUsers,
    }
    } catch (error) {
      
    }
  }

  findOne(id: number) {
    return `This action returns a #${id} userPage`;
  }

  update(id: number, updateUserPageDto: UpdateUserPageDto) {
    return `This action updates a #${id} userPage`;
  }

  remove(id: number) {
    return `This action removes a #${id} userPage`;
  }
}
