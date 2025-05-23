import { PrismaClient, Experience, Role } from '@prisma/client';
import { hash } from 'bcrypt';
import * as config from '../config/settings.development.json';

const prisma = new PrismaClient();

interface Review {
  userId: number; // Reviewer user ID
  rating: number;
  comment: string;
  createdAt?: string; // Optional creation date
}

interface ReviewData {
  profileId: number; // Profile ID being reviewed
  reviews: Review[];
}

async function main() {
  console.log('Seeding the database');

  // Seed Users First
  const password = await hash('changeme', 10);
  const users = await Promise.all(
    config.defaultAccounts.map(async (account) => {
      let role: Role = 'USER';
      if (account.role === 'ADMIN') {
        role = 'ADMIN';
      }
      console.log(`  Creating user: ${account.email} with role: ${role}`);
      return prisma.user.upsert({
        where: { email: account.email },
        update: {},
        create: {
          email: account.email,
          password,
          role,
        },
      });
    }),
  );

  // Log added users
  console.log('Seeded Users:', users);

  // Seed Profiles
  const profiles = await Promise.all(
    config.defaultProfiles.map(async (profile) => {
      console.log(`  Adding Profile: ${profile.username}`);
      const user = users.find((u) => u.email === profile.userEmail);

      if (!user) {
        console.error(`No user found for profile with email: ${profile.userEmail}`);
        return null;
      }

      return prisma.profile.upsert({
        where: { userId: user.id },
        update: {},
        create: {
          userId: user.id,
          username: profile.username,
          firstName: profile.firstName,
          lastName: profile.lastName,
          image: profile.image,
          rating: profile.rating,
          musicalGoals: profile.musicalGoals,
          musicalTastes: profile.musicalTastes,
          instruments: profile.instruments,
          experience: profile.experience as Experience,
          description: profile.description,
        },
      });
    }),
  );

  // Null Filtered Profiles
  const validProfiles = profiles.filter((p) => p !== null);
  console.log('Valid Profiles:', validProfiles);

  // Log added profiles
  console.log('Seeded Profiles:', profiles);

  // Seed Reviews
  const defaultReviews: ReviewData[] = config.defaultReviews;
  await Promise.all(
    defaultReviews.map(async ({ profileId, reviews }: ReviewData) => {
      const profile = profiles.find((p) => p?.id === profileId);

      console.log(`Looking for profileId: ${profileId}`);
      console.log(
        'Available Profiles:',
        profiles.map((p) => p?.id),
      );

      if (!profile) {
        console.error(`No profile found for ID: ${profileId}`);
        return;
      }

      console.log(`Adding Reviews for Profile ID: ${profileId}`);
      await Promise.all(
        reviews.map(async ({ rating, comment, userId, createdAt }: Review) => {
          const reviewer = users.find((u) => u.id === userId);

          // Log Added
          console.log(`Looking for userId: ${userId}`);
          console.log(
            'Available Users:',
            users.map((u) => u.id),
          );

          if (!reviewer) {
            console.error(`No user found for reviewer ID: ${userId}`);
            return;
          }

          await prisma.review.create({
            data: {
              rating,
              comment,
              profileId: profile.id,
              userId: reviewer.id,
              createdAt: createdAt ? new Date(createdAt) : undefined, // Use provided date or default
            },
          });
        }),
      );
    }),
  );
main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
