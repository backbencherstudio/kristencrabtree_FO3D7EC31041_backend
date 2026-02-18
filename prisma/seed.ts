import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// Helper function (replacing StringHelper.cfirst)
function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

async function main() {
  console.log('Seeding started...');

  // Seed roles
  console.log('Seeding roles...');
  // await prisma.role.createMany({
  //   data: [
  //     { id: '1', title: 'Super Admin', name: 'su_admin' },
  //     { id: '2', title: 'Admin', name: 'admin' },
  //     { id: '3', title: 'Project Manager', name: 'project_manager' },
  //     { id: '4', title: 'Member', name: 'member' },
  //     { id: '5', title: 'Viewer', name: 'viewer' },
  //   ],
  // });
  // console.log('✓ Roles seeded');

  // Seed permissions
  // console.log('Seeding permissions...');
  // let i = 0;
  // const permissions = [];
  // const permissionGroups = [
  //   { title: 'system_tenant_management', subject: 'SystemTenant' },
  //   { title: 'user_management', subject: 'User' },
  //   { title: 'role_management', subject: 'Role' },
  //   { title: 'Project', subject: 'Project' },
  //   {
  //     title: 'Task',
  //     subject: 'Task',
  //     scope: ['read', 'create', 'update', 'show', 'delete', 'assign'],
  //   },
  //   { title: 'Comment', subject: 'Comment' },
  // ];

  // for (const permissionGroup of permissionGroups) {
  //   const scope = permissionGroup['scope'] || ['read', 'create', 'update', 'show', 'delete'];
  //   for (const permission of scope) {
  //     permissions.push({
  //       id: String(++i),
  //       title: permissionGroup.title + '_' + permission,
  //       action: capitalizeFirst(permission),
  //       subject: permissionGroup.subject,
  //     });
  //   }
  // }

  // await prisma.permission.createMany({ data: permissions });
  // console.log('✓ Permissions seeded');

  // Seed user
  console.log('Seeding user...');
  const hashedPassword = await bcrypt.hash('12356', 10);
  
  // const systemUser = await prisma.user.create({
  //   data: {
  //     username: 'admin',
  //     email: 'admin@example.com',
  //     password: hashedPassword,
  //     type: 'admin',
  //   },
  // });

  const systemUser = await prisma.user.upsert({
  where: {
    email: 'admin@example.com',
  },
  update: {}, // nothing to update (or add fields if you want)
  create: {
    username: 'admin',
    email: 'admin@example.com',
    password: hashedPassword,
  },
});
  console.log('✓ User created with ID:', systemUser.id);

  // Assign role to user
  // await prisma.roleUser.create({
  //   data: {
  //     user_id: systemUser.id,
  //     role_id: '1',
  //   },
  // });
  console.log('✓ Role assigned to user');

  // Seed permission-role relationships
  // console.log('Seeding permission-role relationships...');
  // const all_permissions = await prisma.permission.findMany();

  // // Super admin permissions
  // const su_admin_permissions = all_permissions.filter(
  //   (p) => p.title.substring(0, 25) === 'system_tenant_management_'
  // );
  
  // if (su_admin_permissions.length > 0) {
  //   await prisma.permissionRole.createMany({
  //     data: su_admin_permissions.map((p) => ({
  //       role_id: '1',
  //       permission_id: p.id,
  //     })),
  //   });
  // }

  const plans=["free","monthly","yearly"];
  for(const plan of plans){
    if(plan==="free"){
      await prisma.accessForSubscription.create({
        data:{
          id:"1",
          subscriptionName:"free",
          journal_entries:2,
          quotesPerday:1,
          digsPerWeek:3,
          murmurationLimit:true,
          audioPostJournal:false,
          meditationAccess:false,
          adService:true,
        }
      })
    } else if(plan==="monthly"){
      await prisma.accessForSubscription.create({
        data:{
          id:"2",
          subscriptionName: "monthly",
          journal_entries:null,
          quotesPerday:null,
          digsPerWeek:null,
          murmurationLimit:false,
          audioPostJournal:true,
          meditationAccess:true,
          adService:false,
        }
      })
    }
    else if(plan==="yearly"){
      await prisma.accessForSubscription.create({
        data:{
          id:"3",
          subscriptionName:"yearly",
          journal_entries:null,
          quotesPerday:null,
          digsPerWeek:null,
          murmurationLimit:false,
          audioPostJournal:true,
          meditationAccess:true,
          adService:false,
        }
      })
    }
    console.log("Plan Permissions seed successfull");
  }

  // Admin permissions
  // const project_admin_permissions = all_permissions.filter(
  //   (p) => p.title.substring(0, 25) !== 'system_tenant_management_'
  // );
  
  // if (project_admin_permissions.length > 0) {
  //   await prisma.permissionRole.createMany({
  //     data: project_admin_permissions.map((p) => ({
  //       role_id: '2',
  //       permission_id: p.id,
  //     })),
  //   });
  // }

  // console.log('✓ Permission roles seeded');
  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });