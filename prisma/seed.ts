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

  let i = 0;
  for (const group of permissionGroups) {
    const scope = group.scope ?? ['read', 'create', 'update', 'show', 'delete'];
    for (const action of scope) {
      i++;
      const permTitle = `${group.title}_${action}`;
      const existing = await prisma.permission.findUnique({
        where: { id: String(i) },
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

  // ── Access for subscription ────────────────────────────────────────────────
  const accessPlans = [
    {
      id: 'access_free',
      subscriptionName: 'free',
      journal_entries: 2,
      quotesPerday: 1,
      digsPerWeek: 3,
      murmurationLimit: false,
      audioPostJournal: false,
      meditationAccess: false,
      adService: true,
    },
    {
      id: 'access_monthly',
      subscriptionName: 'monthly',
      journal_entries: null,
      quotesPerday: null,
      digsPerWeek: null,
      murmurationLimit: true,
      audioPostJournal: true,
      meditationAccess: true,
      adService: false,
    },
    {
      id: 'access_yearly',
      subscriptionName: 'yearly',
      journal_entries: null,
      quotesPerday: null,
      digsPerWeek: null,
      murmurationLimit: true,
      audioPostJournal: true,
      meditationAccess: true,
      adService: false,
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

  let adminUser = await prisma.user.findUnique({
    where: { email: 'admin@gmail.com' },
  });
  if (adminUser) {
    console.log(`✅ Admin user already exists: ${adminUser.id}`);
  } else {
    adminUser = await prisma.user.create({
      data: {
        username: 'admin',
        email: 'admin@gmail.com',
        password: hashedPassword,
        type: 'admin',
      },
    });
    console.log(`🚀 Admin user created: ${adminUser.id}`);
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
        acheivedXp: 120,
        currentLevel: 2,
      },
    });
    console.log(`🚀 Normal user created: ${normalUser.id}`);
  }

  // ── Role assignment ────────────────────────────────────────────────────────
  const existingRoleUser = await prisma.roleUser.findFirst({
    where: { user_id: adminUser.id, role_id: '1' },
  });
  if (existingRoleUser) {
    console.log(`✅ Role already assigned to admin user`);
  } else {
    await prisma.roleUser.create({
      data: { user_id: adminUser.id, role_id: '1' },
    });
    console.log(`🚀 Role assigned to admin user`);
  }

  // ── Permission-role relationships ──────────────────────────────────────────
  const allPermissions = await prisma.permission.findMany();

  const suAdminPerms = allPermissions.filter((p) =>
    p.title.startsWith('system_tenant_management_'),
  );
  for (const perm of suAdminPerms) {
    const existing = await prisma.permissionRole.findFirst({
      where: { role_id: '1', permission_id: perm.id },
    });
    if (!existing) {
      await prisma.permissionRole.create({
        data: { role_id: '1', permission_id: perm.id },
      });
      console.log(`🚀 Permission-role created: su_admin → ${perm.title}`);
    }
  }

  const adminPerms = allPermissions.filter(
    (p) => !p.title.startsWith('system_tenant_management_'),
  );
  for (const perm of adminPerms) {
    const existing = await prisma.permissionRole.findFirst({
      where: { role_id: '2', permission_id: perm.id },
    });
    if (!existing) {
      await prisma.permissionRole.create({
        data: { role_id: '2', permission_id: perm.id },
      });
      console.log(`🚀 Permission-role created: admin → ${perm.title}`);
    }
  }

  // ── Plans (DB + Stripe) ────────────────────────────────────────────────────
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

  const plansDisplayData = [
    {
      id: 'plan_free',
      title: 'Free',
      subtitle: 'Perfect for getting started',
      description: 'Start the dig—no pressure, just curiosity.',
      price: '0.00',
      price_in_cents: 0,
      tag: 'free',
      interval: null,
      features: [
        'Limited journaling entries',
        'Daily quotes and inspiration',
        'Three question/exercise per week',
        'Read-only community access',
        'Basic progress tracking',
        'Ad-supported experience',
      ],
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
      interval: null as null,
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

    if (plan.price_in_cents > 0) {
      try {
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

        const existingPrices = await stripe.prices.list({
          product: product.id,
          active: true,
        });

        const matchingPrice = existingPrices.data.find((p) => {
          if (p.unit_amount !== plan.price_in_cents) return false;
          if (plan.interval) {
            return p.recurring?.interval === plan.interval;
          }
          return p.recurring === null;
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
            currency: 'usd',
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

    await prisma.plans.create({
      data: {
        id: plan.id,
        title: plan.title,
        subtitle: plan.subtitle,
        description: plan.description,
        price: plan.price,
        tag: plan.tag,
        features: plan.features,
        stripe_product_id,
        stripe_price_id,
      },
    });

    console.log(`🚀 Plan created in DB: ${plan.title}`);
  }

  // ── Quotes ──────────────────────────────────────────────────────────────────
  console.log('\n📖 Seeding Quotes...');

  const quotesData = [
    {
      quote_author: 'Rumi',
      quote_text: 'The wound is the place where the Light enters you.',
      reason: 'A reminder that our struggles are often our greatest teachers.',
      type: ['Mental_Body', 'Emotional_Body'] as any,
      status: true,
    },
    {
      quote_author: 'Carl Jung',
      quote_text:
        'Until you make the unconscious conscious, it will direct your life and you will call it fate.',
      reason: 'Self-awareness is the foundation of personal growth.',
      type: ['Mental_Body'] as any,
      status: true,
    },
    {
      quote_author: 'Brené Brown',
      quote_text:
        "Vulnerability is not winning or losing; it's having the courage to show up and be seen when we have no control over the outcome.",
      reason: 'Courage to be vulnerable leads to deeper connection.',
      type: ['Emotional_Body'] as any,
      status: true,
    },
    {
      quote_author: 'Viktor Frankl',
      quote_text:
        'Between stimulus and response there is a space. In that space is our power to choose our response.',
      reason: 'We always have the freedom to choose our reaction.',
      type: ['Mental_Body', 'Energy_Body'] as any,
      status: true,
    },
    {
      quote_author: 'Thich Nhat Hanh',
      quote_text:
        'The present moment is the only moment available to us, and it is the door to all moments.',
      reason: 'Mindfulness begins with returning to the now.',
      type: ['Energy_Body', 'Mental_Body'] as any,
      status: true,
    },
    {
      quote_author: 'Epictetus',
      quote_text:
        "It's not what happens to you, but how you react to it that matters.",
      reason: 'Stoic wisdom on the power of perspective.',
      type: ['Mental_Body'] as any,
      status: true,
    },
    {
      quote_author: 'Maya Angelou',
      quote_text:
        'You may not control all the events that happen to you, but you can decide not to be reduced by them.',
      reason: 'Resilience is a choice we make every day.',
      type: ['Emotional_Body', 'Physical_Body'] as any,
      status: true,
    },
    {
      quote_author: 'Lao Tzu',
      quote_text:
        'Knowing others is intelligence; knowing yourself is true wisdom.',
      reason: 'Self-knowledge is the deepest form of understanding.',
      type: ['Mental_Body', 'Energy_Body'] as any,
      status: true,
    },
  ];

  for (const quote of quotesData) {
    const existing = await prisma.quote.findFirst({
      where: { quote_text: quote.quote_text },
    });
    if (existing) {
      console.log(`✅ Quote already exists: "${quote.quote_author}"`);
    } else {
      await prisma.quote.create({
        data: { ...quote, user_id: adminUser.id },
      });
      console.log(`🚀 Quote created: ${quote.quote_author}`);
    }
  }

  // ── Meditations ─────────────────────────────────────────────────────────────
  console.log('\n🧘 Seeding Meditations...');

  const meditationsData = [
    {
      meditation_name: 'Morning Stillness',
      meditation_description:
        'A gentle 10-minute guided meditation to start your day with clarity and intention. Focus on your breath and let go of yesterday.',
      duration: '10:00',
    },
    {
      meditation_name: 'Body Scan for Deep Rest',
      meditation_description:
        'A progressive body scan from head to toe designed to release physical tension and invite deep relaxation.',
      duration: '20:00',
    },
    {
      meditation_name: 'Emotional Release',
      meditation_description:
        'This practice gently guides you to acknowledge and release stored emotions through breath and visualization.',
      duration: '15:00',
    },
    {
      meditation_name: 'Inner Silence',
      meditation_description:
        'A minimalist meditation that strips everything back to pure awareness. No guidance, just presence.',
      duration: '08:00',
    },
    {
      meditation_name: 'Heart-Centered Breathing',
      meditation_description:
        'Breathe in compassion, breathe out tension. This heart-focused practice builds emotional resilience and self-love.',
      duration: '12:00',
    },
    {
      meditation_name: 'Grounding in Nature',
      meditation_description:
        'Visualize yourself in a peaceful natural setting to restore your connection to the earth and your own body.',
      duration: '18:00',
    },
  ];

  const createdMeditations: string[] = [];

  for (const med of meditationsData) {
    const existing = await prisma.meditation.findFirst({
      where: { meditation_name: med.meditation_name },
    });
    if (existing) {
      console.log(`✅ Meditation already exists: ${med.meditation_name}`);
      createdMeditations.push(existing.id);
    } else {
      const created = await prisma.meditation.create({ data: med });
      createdMeditations.push(created.id);
      console.log(`🚀 Meditation created: ${med.meditation_name}`);
    }
  }

  // ── Journals for normal user ─────────────────────────────────────────────────
  console.log('\n📔 Seeding Journals...');

  const journalsData = [
    {
      title: 'What am I afraid of?',
      body: "Today I sat with the question of fear. I realized that beneath my frustration at work is a deep fear of not being enough. When I traced it back, it started in school — always feeling like I had to prove myself. This exercise helped me see that the fear is old, not current. I don't need to carry it anymore.",
      type: 'Text' as any,
      tags: ['fear', 'self-awareness', 'growth'],
    },
    {
      title: 'Gratitude and the present moment',
      body: "I spent 10 minutes writing everything I'm grateful for today. Small things: the coffee tasting good, a smile from a stranger, finishing a task I'd been avoiding. It's surprising how this simple practice shifts my entire outlook. I feel lighter.",
      type: 'Text' as any,
      tags: ['gratitude', 'mindfulness', 'presence'],
    },
    {
      title: 'Reflection on anger',
      body: "Something interesting happened — I got really angry today and instead of reacting, I paused. I asked myself: what is this anger protecting? It was protecting a feeling of being dismissed. That's the real wound. The anger was just the guard at the door. Once I saw that, the anger dissolved.",
      type: 'Text' as any,
      tags: ['anger', 'emotions', 'reflection'],
    },
    {
      title: 'Who am I without the noise?',
      body: "In the quiet this morning I tried to just be — no phone, no tasks, no identity. Just awareness. It's uncomfortable at first. The mind wants to fill every silence. But I stayed. And in that staying, something shifted. A kind of peace I'd forgotten existed.",
      type: 'Text' as any,
      tags: ['identity', 'stillness', 'meditation'],
    },
    {
      title: 'A letter to my younger self',
      body: "Dear younger me, I know how hard things feel right now. You are doing your best with what you have. The confusion you feel isn't weakness — it's the beginning of wisdom. You will find your way. And along the way, you will help others find theirs.",
      type: 'Text' as any,
      tags: ['self-compassion', 'healing', 'inner-child'],
    },
  ];

  for (const journal of journalsData) {
    const existing = await prisma.journel.findFirst({
      where: { title: journal.title, user_id: normalUser.id },
    });
    if (existing) {
      console.log(`✅ Journal already exists: ${journal.title}`);
    } else {
      await prisma.journel.create({
        data: { ...journal, user_id: normalUser.id },
      });
      console.log(`🚀 Journal created: ${journal.title}`);
    }
  }

  // ── Digs ────────────────────────────────────────────────────────────────────
  console.log('\n⛏️  Seeding Digs...');

  const digsData = [
    {
      title: 'Emotional Intelligence',
      type: ['Mental_Body', 'Emotional_Body'] as any,
      layers: [
        {
          question_name: 'The_Question' as any,
          question_type: 'Option' as any,
          point: 20,
          question:
            'When you feel overwhelmed, what emotion is usually beneath the surface?',
          options: ['Fear', 'Sadness', 'Anger', 'Shame', 'Loneliness'],
          other: true,
          other_text: 'Other (please specify)',
          text: null,
          correct_answer: 'Fear',
        },
        {
          question_name: 'The_Journal' as any,
          question_type: 'Text' as any,
          point: 20,
          question:
            'Explore in your journal "where" or "why" this gets triggered. Or anything else that comes to mind.',
          options: [],
          other: false,
          other_text: '',
          text: 'Journal entry copies (if possible) to their actual journal...',
          correct_answer: null,
        },
        {
          question_name: 'The_Experience' as any,
          question_type: 'Option' as any,
          point: 20,
          question:
            'If you dug in deeper to your response, set a simple goal for yourself to either:',
          options: [
            'Reflect on this further',
            'Become aware when it occurs',
            'Make one small change in your routine',
            'Create a different goal of your choosing',
          ],
          other: true,
          other_text: 'Other (please specify)',
          text: null,
          correct_answer: 'Reflect on this further',
        },
        {
          question_name: 'The_Reflection' as any,
          question_type: 'Text' as any,
          point: 20,
          question: 'Make a quick journal entry about this Dig.',
          options: [],
          other: false,
          other_text: '',
          text: 'Journal entry copies (if possible) to their actual journal...',
          correct_answer: null,
        },
      ],
    },
    {
      title: 'Understanding Fear',
      type: ['Emotional_Body'] as any,
      layers: [
        {
          question_name: 'The_Question' as any,
          question_type: 'Option' as any,
          point: 25,
          question: 'Where in your body do you most feel fear?',
          options: ['Chest', 'Stomach', 'Throat', 'Head'],
          other: true,
          other_text: 'Other (please specify)',
          text: null,
          correct_answer: 'Chest',
        },
        {
          question_name: 'The_Journal' as any,
          question_type: 'Text' as any,
          point: 25,
          question:
            'Write about a recent moment when fear showed up. What triggered it?',
          options: [],
          other: false,
          other_text: '',
          text: 'Describe the situation, the feeling, and any thoughts that arose...',
          correct_answer: null,
        },
        {
          question_name: 'The_Experience' as any,
          question_type: 'Option' as any,
          point: 25,
          question:
            'What is one way you can acknowledge fear without being controlled by it?',
          options: [
            'Name it out loud',
            'Breathe through it',
            'Write it down',
            'Share it with someone I trust',
          ],
          other: true,
          other_text: 'Other (please specify)',
          text: null,
          correct_answer: 'Breathe through it',
        },
        {
          question_name: 'The_Reflection' as any,
          question_type: 'Text' as any,
          point: 25,
          question:
            'What did you learn about your relationship with fear today?',
          options: [],
          other: false,
          other_text: '',
          text: 'Reflect freely on what came up for you...',
          correct_answer: null,
        },
      ],
    },
    {
      title: 'The Inner Critic',
      type: ['Mental_Body'] as any,
      layers: [
        {
          question_name: 'The_Question' as any,
          question_type: 'Option' as any,
          point: 20,
          question:
            'How often does your inner critic speak to you during the day?',
          options: ['Constantly', 'Several times', 'Occasionally', 'Rarely'],
          other: false,
          other_text: '',
          text: null,
          correct_answer: 'Several times',
        },
        {
          question_name: 'The_Journal' as any,
          question_type: 'Text' as any,
          point: 20,
          question:
            'Write down the most common thing your inner critic says to you. Then respond to it as you would a dear friend.',
          options: [],
          other: false,
          other_text: '',
          text: 'What does your inner critic say most often? How would you reframe it?',
          correct_answer: null,
        },
        {
          question_name: 'The_Experience' as any,
          question_type: 'Option' as any,
          point: 20,
          question:
            'What strategy feels most natural for quieting your inner critic?',
          options: [
            'Notice and label the thought',
            'Counter it with a positive truth',
            'Breathe and let it pass',
            'Write it out and release it',
          ],
          other: true,
          other_text: 'Other (please specify)',
          text: null,
          correct_answer: 'Notice and label the thought',
        },
        {
          question_name: 'The_Reflection' as any,
          question_type: 'Text' as any,
          point: 20,
          question: 'How did it feel to talk back to your inner critic today?',
          options: [],
          other: false,
          other_text: '',
          text: 'Capture any shifts in how you feel after this exercise...',
          correct_answer: null,
        },
      ],
    },
    {
      title: 'Boundaries & Self-Respect',
      type: ['Emotional_Body', 'Physical_Body'] as any,
      layers: [
        {
          question_name: 'The_Question' as any,
          question_type: 'Option' as any,
          point: 30,
          question:
            'Which area of your life most needs a clearer boundary right now?',
          options: ['Work', 'Family', 'Friendships', 'Romantic relationships'],
          other: true,
          other_text: 'Other (please specify)',
          text: null,
          correct_answer: 'Work',
        },
        {
          question_name: 'The_Journal' as any,
          question_type: 'Text' as any,
          point: 30,
          question:
            'Describe a situation where you wish you had held a boundary. What stopped you?',
          options: [],
          other: false,
          other_text: '',
          text: 'Be honest with yourself. What gets in the way of your boundaries?',
          correct_answer: null,
        },
        {
          question_name: 'The_Experience' as any,
          question_type: 'Option' as any,
          point: 30,
          question:
            'What small, specific action can you take this week to honor a boundary?',
          options: [
            'Say no to one request',
            'Leave a situation that drains me',
            'Have one honest conversation',
            'Protect one hour of my time',
          ],
          other: true,
          other_text: 'Other (please specify)',
          text: null,
          correct_answer: 'Say no to one request',
        },
        {
          question_name: 'The_Reflection' as any,
          question_type: 'Text' as any,
          point: 30,
          question:
            'What does having good boundaries say about how you value yourself?',
          options: [],
          other: false,
          other_text: '',
          text: 'Reflect on the connection between boundaries and self-worth...',
          correct_answer: null,
        },
      ],
    },
    {
      title: 'Purpose & Direction',
      type: ['Mental_Body', 'Energy_Body'] as any,
      layers: [
        {
          question_name: 'The_Question' as any,
          question_type: 'Option' as any,
          point: 20,
          question: 'When do you feel most alive and in flow?',
          options: [
            'When helping others',
            'When creating something',
            'When learning something new',
            'When in nature or silence',
          ],
          other: true,
          other_text: 'Other (please specify)',
          text: null,
          correct_answer: 'When creating something',
        },
        {
          question_name: 'The_Journal' as any,
          question_type: 'Text' as any,
          point: 20,
          question:
            'Describe a moment in your life when you felt completely on purpose. What were you doing? Who were you being?',
          options: [],
          other: false,
          other_text: '',
          text: 'Paint the picture of that moment as vividly as you can...',
          correct_answer: null,
        },
        {
          question_name: 'The_Experience' as any,
          question_type: 'Option' as any,
          point: 20,
          question:
            'What is one thing you can do this week to move closer to your purpose?',
          options: [
            'Dedicate 30 mins to something I love',
            'Talk to someone who inspires me',
            'Research one new possibility',
            'Remove one thing that distracts me',
          ],
          other: true,
          other_text: 'Other (please specify)',
          text: null,
          correct_answer: 'Dedicate 30 mins to something I love',
        },
        {
          question_name: 'The_Reflection' as any,
          question_type: 'Text' as any,
          point: 20,
          question: 'How connected do you feel to your purpose after this Dig?',
          options: [],
          other: false,
          other_text: '',
          text: 'Notice any shifts in your sense of direction or energy...',
          correct_answer: null,
        },
      ],
    },
  ];

  const createdDigIds: string[] = [];

  for (const dig of digsData) {
    const existing = await prisma.digs.findFirst({
      where: { title: dig.title },
    });
    if (existing) {
      console.log(`✅ Dig already exists: ${dig.title}`);
      createdDigIds.push(existing.id);
    } else {
      const created = await prisma.digs.create({
        data: {
          title: dig.title,
          type: { set: dig.type },
          user_id: adminUser.id,
          layers: {
            create: dig.layers.map((layer) => ({
              ...layer,
              user_id: adminUser.id,
            })),
          },
        },
      });
      createdDigIds.push(created.id);
      console.log(`🚀 Dig created: ${dig.title} (${dig.layers.length} layers)`);
    }
  }

  // ── Murmurations (community posts) ──────────────────────────────────────────
  console.log('\n💬 Seeding Murmurations...');

  const murmurationsData = [
    {
      title: 'My breakthrough with fear',
      text: 'I just completed the Emotional Intelligence dig and something cracked open. I\'ve been carrying fear for so long that I thought it was just "me." Turns out it\'s just a layer. And layers can be peeled. Grateful for this space.',
      type: 'Text' as any,
    },
    {
      title: 'On boundaries',
      text: "Said no for the first time in months today. It felt awful and amazing at the same time. Anyone else experience that? Like guilt and freedom mixed together? I think that's growth.",
      type: 'Text' as any,
    },
    {
      title: 'The inner critic is loud today',
      text: "Doing the Inner Critic dig hit different this week. Mine is brutal. But naming it — actually giving it a name — helped me realize it's not me. It's a voice I picked up along the way. Today I'm choosing not to believe it.",
      type: 'Text' as any,
    },
    {
      title: 'Grateful for this community',
      text: "Week 3 in and I've journaled more than I have in the past 3 years. The structure of the digs makes it feel achievable. One question at a time. That's all it takes. Thank you everyone who shares here — it keeps me going.",
      type: 'Text' as any,
    },
  ];

  for (const post of murmurationsData) {
    const existing = await prisma.murmuration.findFirst({
      where: { title: post.title },
    });
    if (existing) {
      console.log(`✅ Murmuration already exists: ${post.title}`);
    } else {
      await prisma.murmuration.create({
        data: { ...post, user_id: normalUser.id },
      });
      console.log(`🚀 Murmuration created: ${post.title}`);
    }
  }

  // ── Notification Events ──────────────────────────────────────────────────────
  console.log('\n🔔 Seeding Notification Events...');

  const notifEvents = [
    { type: 'new_dig', text: 'A new Dig has been published for you.' },
    { type: 'dig_completed', text: 'Congratulations! You completed a Dig.' },
    { type: 'xp_earned', text: 'You earned XP for your activity!' },
    { type: 'new_quote', text: 'Your daily quote is ready.' },
    { type: 'reminder', text: "Don't forget to complete your weekly Dig." },
  ];

  for (const event of notifEvents) {
    const existing = await prisma.notificationEvent.findFirst({
      where: { type: event.type },
    });
    if (existing) {
      console.log(`✅ Notification event already exists: ${event.type}`);
    } else {
      await prisma.notificationEvent.create({ data: event });
      console.log(`🚀 Notification event created: ${event.type}`);
    }
  }

  // ── Sample notifications for normal user ─────────────────────────────────────
  const notifEvent = await prisma.notificationEvent.findFirst({
    where: { type: 'new_dig' },
  });

  if (notifEvent) {
    const existingNotif = await prisma.notification.findFirst({
      where: {
        receiver_id: normalUser.id,
        notification_event_id: notifEvent.id,
      },
    });
    if (!existingNotif) {
      await prisma.notification.create({
        data: {
          sender_id: adminUser.id,
          receiver_id: normalUser.id,
          notification_event_id: notifEvent.id,
          entity_id: createdDigIds[0] ?? null,
        },
      });
      console.log(`🚀 Sample notification created for normal user`);
    }
  }

  // ── Assign weekly digs for normal user ──────────────────────────────────────
  console.log('\n📅 Seeding Weekly Dig assignments...');

  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const weekStart = new Date(now.setDate(diff));
  weekStart.setHours(0, 0, 0, 0);

  for (let pos = 0; pos < Math.min(3, createdDigIds.length); pos++) {
    const digId = createdDigIds[pos];
    const existing = await prisma.userWeeklyDig.findFirst({
      where: { userId: normalUser.id, digId, weekStart },
    });
    if (existing) {
      console.log(
        `✅ Weekly dig assignment already exists: position ${pos + 1}`,
      );
    } else {
      await prisma.userWeeklyDig.create({
        data: {
          userId: normalUser.id,
          digId,
          weekStart,
          position: pos + 1,
          completed: pos === 0,
        },
      });
      console.log(`🚀 Weekly dig assigned: position ${pos + 1}`);
    }
  }

  // ── Assign daily digs for normal user ────────────────────────────────────────
  console.log('\n📆 Seeding Daily Dig assignments...');

  for (let num = 1; num <= 2; num++) {
    const digId = createdDigIds[num] ?? createdDigIds[0];
    const existing = await prisma.userDailyDig.findFirst({
      where: { userId: normalUser.id, digId },
    });
    if (existing) {
      console.log(`✅ Daily dig assignment already exists: dig ${num}`);
    } else {
      await prisma.userDailyDig.create({
        data: {
          userId: normalUser.id,
          digId,
          dailyDigNumber: num,
          completed: false,
        },
      });
      console.log(`🚀 Daily dig assigned: dig number ${num}`);
    }
  }

  console.log('\n✨ Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
