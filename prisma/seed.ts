import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import Stripe from 'stripe';

const prisma = new PrismaClient();

function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

async function main() {
  console.log('Seeding started...');

  // ── Roles ──────────────────────────────────────────────────────────────────
  const rolesData = [
    { id: '1', title: 'Super Admin', name: 'su_admin' },
    { id: '2', title: 'Admin', name: 'admin' },
    { id: '3', title: 'Project Manager', name: 'project_manager' },
    { id: '4', title: 'Member', name: 'member' },
    { id: '5', title: 'Viewer', name: 'viewer' },
  ];

  for (const role of rolesData) {
    const existing = await prisma.role.findUnique({ where: { id: role.id } });
    if (existing) {
      console.log(`✅ Role already exists: ${role.title}`);
    } else {
      await prisma.role.create({ data: role });
      console.log(`🚀 Role created: ${role.title}`);
    }
  }

  // ── Permissions ────────────────────────────────────────────────────────────
  const permissionGroups = [
    { title: 'system_tenant_management', subject: 'SystemTenant' },
    { title: 'user_management', subject: 'User' },
    { title: 'role_management', subject: 'Role' },
    { title: 'Project', subject: 'Project' },
    {
      title: 'Task',
      subject: 'Task',
      scope: ['read', 'create', 'update', 'show', 'delete', 'assign'],
    },
    { title: 'Comment', subject: 'Comment' },
  ];

  for (const permissionGroup of permissionGroups) {
    const scope = permissionGroup['scope'] || [
      'read',
      'create',
      'update',
      'show',
      'delete',
    ];
    for (const permission of scope) {
      permissions.push({
        id: String(++i),
        title: permissionGroup.title + '_' + permission,
        action: capitalizeFirst(permission),
        subject: permissionGroup.subject,
      });
      if (existing) {
        console.log(`✅ Permission already exists: ${permTitle}`);
      } else {
        await prisma.permission.create({
          data: {
            id: String(i),
            title: permTitle,
            action: capitalizeFirst(action),
            subject: group.subject,
          },
        });
        console.log(`🚀 Permission created: ${permTitle}`);
      }
    }
  }

  await prisma.permission.createMany({ data: permissions });
  console.log('✓ Permissions seeded');

  // Seed user
  console.log('Seeding user...');
  const hashedPassword = await bcrypt.hash('12345678', 10);

  const systemUser = await prisma.user.create({
    data: {
      username: 'admin',
      email: 'admin@gmail.com',
      password: hashedPassword,
      type: 'admin',
    },
    {
      id: 'plan_monthly',
      title: 'Monthly',
      subtitle: 'For those ready to go deeper',
      description: 'For seekers who want presence to become a practice.',
      price: '8.88',
      price_in_cents: 888,
      tag: 'popular',
      interval: 'month' as const,
      features: [
        'Unlimited text & audio journaling',
        'Unlimited scheduled exercises & questions',
        'Full community participation (post & reply)',
        'Join Murmuration & collaborative experiences',
        'Access to live group sessions & one-on-one coaching',
        'Contribute personal inspirational messages',
        'Who Am I & Mind Expansion experiences',
        'Exclusive curated meditations',
        'Ad-free experience',
        'Advanced progress analytics & export',
      ],
    },
    {
      id: 'plan_annual',
      title: 'Annual',
      subtitle: 'For those ready to go deeper',
      description: "For those who've decided: no more half-hearted living.",
      price: '53.28',
      price_in_cents: 5328,
      tag: '50_off',
      interval: 'year' as const,
      features: [
        'Unlimited text & audio journaling',
        'Unlimited scheduled exercises & questions',
        'Full community participation (post & reply)',
        'Join Murmuration & collaborative experiences',
        'Access to live group sessions & one-on-one coaching',
        'Contribute personal inspirational messages',
        'Who Am I & Mind Expansion experiences',
        'Exclusive curated meditations',
        'Ad-free experience',
        'Advanced progress analytics & export',
      ],
    },
    {
      id: 'plan_lifetime',
      title: 'Lifetime',
      subtitle: 'The Lifetime Access',
      description: 'For those who are all in.',
      price: '222.22',
      price_in_cents: 22222,
      tag: 'special',
      interval: null as null, // one-time payment — no recurring interval
      features: [
        'Everything in Premium, forever',
        'All future premium content & features',
        'Exclusive "The Dig Never Ends" special-edition tee',
        'One-time 45-minute private Excavation Session with Kristen',
        'Priority support & early access to new features',
        'Lifetime community member status',
      ],
    },
  ];

  for (const plan of plansDisplayData) {
    const existing = await prisma.plans.findUnique({ where: { id: plan.id } });

    if (existing) {
      console.log(`✅ Display plan already exists: ${plan.title}`);
      continue;
    }

    let stripe_product_id: string | null = null;
    let stripe_price_id: string | null = null;

    // ── Create Stripe product for all paid plans ───────────────────────────
    // Both recurring (monthly/annual) and one-time (lifetime) need a Stripe
    // product + price so checkout sessions can be created for them.
    if (plan.price_in_cents > 0) {
      try {
        // 1. Check if a Stripe product with this name already exists
        const existingProducts = await stripe.products.search({
          query: `name:'${plan.title}' AND active:'true'`,
        });

        let product: Stripe.Product;

        if (existingProducts.data.length > 0) {
          product = existingProducts.data[0];
          console.log(
            `♻️  Reusing Stripe product: ${product.id} (${plan.title})`,
          );
        } else {
          product = await stripe.products.create({
            name: plan.title,
            description: plan.description,
            metadata: { plan_id: plan.id },
          });
          console.log(
            `🔷 Stripe product created: ${product.id} (${plan.title})`,
          );
        }

        stripe_product_id = product.id;

        // 2. Check if a matching price already exists for this product
        const existingPrices = await stripe.prices.list({
          product: product.id,
          active: true,
        });

        // For recurring plans match on amount + interval.
        // For lifetime (one-time) match on amount + no recurring field.
        const matchingPrice = existingPrices.data.find((p) => {
          if (p.unit_amount !== plan.price_in_cents) return false;
          if (plan.interval) {
            return p.recurring?.interval === plan.interval;
          }
          return p.recurring === null; // one-time price
        });

        let stripePrice: Stripe.Price;

        if (matchingPrice) {
          stripePrice = matchingPrice;
          console.log(
            `♻️  Reusing Stripe price: ${stripePrice.id} (${plan.title})`,
          );
        } else {
          stripePrice = await stripe.prices.create({
            product: product.id,
            unit_amount: plan.price_in_cents,
            currency: '$',
            // Recurring plans get a recurring object; lifetime gets none
            ...(plan.interval
              ? { recurring: { interval: plan.interval } }
              : {}),
            metadata: { plan_id: plan.id },
          });
          console.log(
            `🔷 Stripe price created: ${stripePrice.id} (${plan.title})`,
          );
        }

        stripe_price_id = stripePrice.id;
      } catch (err) {
        console.error(`❌ Stripe error for plan "${plan.title}":`, err);
        throw err;
      }
    }

  const normalUser = await prisma.user.upsert({
  where: { email: 'user@gmail.com' },
  update: {},
  create: {
    username: 'user',
    email: 'user@gmail.com',
    password: hashedPassword,
    type: 'user',
  },
});

console.log('✓ Normal user created:', normalUser.id);

  // Assign role to user
  await prisma.roleUser.create({
    data: {
      user_id: systemUser.id,
      role_id: '1',
    },
  ];

  for (const access of accessPlans) {
    const existing = await prisma.accessForSubscription.findUnique({
      where: { id: access.id },
    });
    if (existing) {
      console.log(`✅ Access plan already exists: ${access.subscriptionName}`);
    } else {
      await prisma.accessForSubscription.create({ data: access });
      console.log(`🚀 Access plan created: ${access.subscriptionName}`);
    }
  }

  // ── Admin user ─────────────────────────────────────────────────────────────
  const hashedPassword = await bcrypt.hash('12345678', 10);

  let systemUser = await prisma.user.findUnique({
    where: { email: 'admin@gmail.com' },
  });
  if (systemUser) {
    console.log(`✅ Admin user already exists: ${systemUser.id}`);
  } else {
    systemUser = await prisma.user.create({
      data: {
        username: 'admin',
        email: 'admin@gmail.com',
        password: hashedPassword,
        type: 'admin',
      },
    });
    console.log(`🚀 Admin user created: ${systemUser.id}`);
  }

  // ── Normal user ────────────────────────────────────────────────────────────
  let normalUser = await prisma.user.findUnique({
    where: { email: 'user@gmail.com' },
  });
  if (normalUser) {
    console.log(`✅ Normal user already exists: ${normalUser.id}`);
  } else {
    normalUser = await prisma.user.create({
      data: {
        username: 'user',
        email: 'user@gmail.com',
        password: hashedPassword,
        type: 'user',
      },
    });
    console.log(`🚀 Normal user created: ${normalUser.id}`);
  }

  // Super admin permissions
  const su_admin_permissions = all_permissions.filter(
    (p) => p.title.substring(0, 25) === 'system_tenant_management_',
  );

  if (su_admin_permissions.length > 0) {
    await prisma.permissionRole.createMany({
      data: su_admin_permissions.map((p) => ({
        role_id: '1',
        permission_id: p.id,
      })),
    });
    if (existing) {
      console.log(
        `✅ Permission-role already exists: su_admin → ${perm.title}`,
      );
    } else {
      await prisma.permissionRole.create({
        data: { role_id: '1', permission_id: perm.id },
      });
      console.log(`🚀 Permission-role created: su_admin → ${perm.title}`);
    }
  }

  // Admin permissions
  const project_admin_permissions = all_permissions.filter(
    (p) => p.title.substring(0, 25) !== 'system_tenant_management_',
  );

  if (project_admin_permissions.length > 0) {
    await prisma.permissionRole.createMany({
      data: project_admin_permissions.map((p) => ({
        role_id: '2',
        permission_id: p.id,
      })),
    });
    if (existing) {
      console.log(`✅ Permission-role already exists: admin → ${perm.title}`);
    } else {
      await prisma.permissionRole.create({
        data: { role_id: '2', permission_id: perm.id },
      });
      console.log(`🚀 Permission-role created: admin → ${perm.title}`);
    }
  }

  console.log('\\n✨ Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
