/**
 * Seed script — insert the dedicated UTRGV tenant and core campus offices.
 *
 * Idempotent: the tenant and offices are only inserted if they do not already exist.
 *
 * Usage:
 *   npx tsx scripts/seed_utrgv.ts
 */
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(__dirname, "../../.env") });

import { randomBytes, randomUUID } from "crypto";
import { eq, and } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import Redis from "ioredis";
import { tenants, departments } from "../server/db/schema";
import { invalidateDeptCache } from "../server/services/cache_service";

const client = postgres(process.env.DATABASE_URL!, { max: 1 });
const db = drizzle(client);
const redis = new Redis(process.env.REDIS_URL!);

interface Location {
  street?: string;
  city?: string;
  state?: string;
  zipcode?: string;
  country?: string;
}

interface OfficeConfig {
  name: string;
  phone: string | null;
  email: string | null;
  keywords: string;
  location?: Location;
  hours: string | null;
}

const UTRGV = {
  name: "The University of Texas Rio Grande Valley",
  slug: "utrgv",
  websiteDomain: "utrgv.edu",
  searchDomains: [
    "utrgv.edu",
    "www.utrgv.edu",
    "my.utrgv.edu",
    "catalog.utrgv.edu",
    "calendar.utrgv.edu",
  ],
  logoPath: "logos/utrgv.png",
  widgetSettings: {
    cityName: "UTRGV Campus Assist",
    primaryColor: "#EEB111",
    welcomeMessage:
      "Hi! I'm UTRGV Campus Assist. Ask me about admissions, registration, financial aid, academics, housing, or campus services.",
    autoOpen: false,
    position: "bottom-right",
  },
};

const OFFICES: OfficeConfig[] = [
  {
    name: "Undergraduate Admissions",
    phone: "1-844-ATUTRGV",
    email: "admissions@utrgv.edu",
    keywords:
      "admissions,apply,application,undergraduate,freshman,transfer,deadline,visit,campus tour,enrollment,new student",
    location: {
      street: "1201 W University Dr",
      city: "Edinburg",
      state: "TX",
      zipcode: "78539",
      country: "USA",
    },
    hours: "Mon - Fri: 8 AM - 5 PM",
  },
  {
    name: "Financial Aid",
    phone: "1-844-ATUTRGV",
    email: "finaid@utrgv.edu",
    keywords:
      "financial aid,fafsa,aid,scholarship,grant,loan,verification,sap,pell,award,tuition assistance",
    location: {
      street: "1201 W University Dr, Student Services Bldg 1st Floor",
      city: "Edinburg",
      state: "TX",
      zipcode: "78539",
      country: "USA",
    },
    hours: "Mon, Wed, Fri: 8 AM - 5 PM; Tue: 8 AM - 6 PM; Thu: 9 AM - 5 PM",
  },
  {
    name: "Graduate Admissions",
    phone: "1-833-887-4842",
    email: "gradcollege@utrgv.edu",
    keywords:
      "graduate,masters,doctoral,phd,grad school,graduate admission,graduate admissions,grad admissions,graduate program,thesis,dissertation,international graduate",
    hours: "Mon - Fri: 8 AM - 5 PM",
    location: {
      street: "1201 W University Dr",
      city: "Edinburg",
      state: "TX",
      zipcode: "78539",
      country: "USA",
    },
  },
  {
    name: "International Student Services",
    phone: "(956) 665-2922",
    email: "international@utrgv.edu",
    keywords:
      "international,international student,international office,f-1,visa,i-20,study abroad,international admissions,international application,sevis,cpt,opt",
    location: {
      street: "1201 West University Dr, EMASS 1.102",
      city: "Edinburg",
      state: "TX",
      zipcode: "78539",
      country: "USA",
    },
    hours: "Mon - Fri: 8 AM - 5 PM",
  },
  {
    name: "Registrar",
    phone: "(956) 882-4026",
    email: "ucentral@utrgv.edu",
    keywords:
      "registrar,registration,register,class schedule,drop,withdraw,transcript,ferpa,academic calendar,records",
    location: {
      street: "1201 W University Dr, Student Services Bldg 1st Floor",
      city: "Edinburg",
      state: "TX",
      zipcode: "78539",
      country: "USA",
    },
    hours: "Mon, Wed, Fri: 8 AM - 5 PM; Tue: 8 AM - 6 PM; Thu: 9 AM - 5 PM",
  },
  {
    name: "U Central",
    phone: "(956) 882-4026",
    email: "ucentral@utrgv.edu",
    keywords:
      "u central,bursar,billing,payment,tuition,balance,refund,holds,student account,payment plan",
    location: {
      street: "1201 W University Dr, Student Services Bldg 1st Floor",
      city: "Edinburg",
      state: "TX",
      zipcode: "78539",
      country: "USA",
    },
    hours: "Mon, Wed, Fri: 8 AM - 5 PM; Tue: 8 AM - 6 PM; Thu: 9 AM - 5 PM",
  },
  {
    name: "Housing and Residence Life",
    phone: "(956) 665-3439",
    email: "home@utrgv.edu",
    keywords:
      "housing,residence life,dorm,dorms,residence hall,on campus housing,casa bella,unity hall,heritage hall,the village",
    location: {
      street: "University Center UC 305",
      city: "Edinburg",
      state: "TX",
      zipcode: "78539",
      country: "USA",
    },
    hours: "Mon - Fri: 8 AM - 5 PM (closed 12 PM - 1 PM)",
  },
  {
    name: "Information Technology",
    phone: "(956) 665-2020",
    // No public general-inquiry email is listed for the IT Service Desk;
    // contact is by phone or the online ticket portal only.
    email: null,
    keywords:
      "it,tech support,password,account,mfa,duo,wifi,blackboard,canvas,email,myutrgv,service desk",
    location: {
      street: "1201 W University Dr, ECCTR Lobby",
      city: "Edinburg",
      state: "TX",
      zipcode: "78539",
      country: "USA",
    },
    hours: "Mon - Fri: 8 AM - 4:45 PM (may close for a 1-hour lunch break)",
  },
  {
    name: "Student Affairs",
    phone: "956-665-2859",
    email: "vpsesa@utrgv.edu",
    keywords:
      "student affairs,student support,student services,conduct,student life,wellbeing,case management",
    location: {
      street: "1201 W University Dr, ESSBL 3.104C",
      city: "Edinburg",
      state: "TX",
      zipcode: "78539",
      country: "USA",
    },
    hours: "Mon - Fri: 8 AM - 5 PM",
  },
  {
    name: "Career Center",
    phone: "(956) 665-2243",
    email: "careercenter@utrgv.edu",
    keywords:
      "career center,career,job,internship,resume,interview,handshake,career fair",
    location: {
      street: "1201 W University Dr, ESTAC 2.101",
      city: "Edinburg",
      state: "TX",
      zipcode: "78539",
      country: "USA",
    },
    hours: "Mon - Fri: 8 AM - 5 PM",
  },
  {
    name: "Student Success",
    phone: "(956) 665-7919",
    email: "StudentSuccess@utrgv.edu",
    keywords:
      "student success,tutoring,academic coaching,advising,retention,peer mentoring,academic support,supplemental instruction",
    location: {
      street: "1201 W University Dr, ESSBL 2.101",
      city: "Edinburg",
      state: "TX",
      zipcode: "78539",
      country: "USA",
    },
    hours: "Mon - Fri: 8 AM - 5 PM",
  },
];

async function seedUtrgv(): Promise<void> {
  console.log("\nUTRGV Campus Assist");
  console.log("─".repeat(40));

  const [existing] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.slug, UTRGV.slug))
    .limit(1);

  let tenantId: string;

  if (existing) {
    tenantId = existing.id;
    console.log(`Tenant exists: ${existing.name}`);
  } else {
    const apiKey = randomBytes(32).toString("hex");
    const [tenant] = await db
      .insert(tenants)
      .values({
        id: randomUUID(),
        name: UTRGV.name,
        slug: UTRGV.slug,
        apiKey,
        websiteDomain: UTRGV.websiteDomain,
        searchDomains: UTRGV.searchDomains,
        logoPath: UTRGV.logoPath,
        isActive: true,
        location: "Edinburg and Brownsville, Texas",
        widgetSettings: UTRGV.widgetSettings,
      })
      .returning();

    tenantId = tenant!.id;
    console.log(`Created tenant: ${tenant!.name}`);
    console.log(`API key: ${tenant!.apiKey}`);
  }

  let created = 0;
  let skipped = 0;

  for (const office of OFFICES) {
    const [existingOffice] = await db
      .select()
      .from(departments)
      .where(
        and(
          eq(departments.tenantId, tenantId),
          eq(departments.name, office.name),
        ),
      )
      .limit(1);

    if (existingOffice) {
      skipped++;
      continue;
    }

    await db.insert(departments).values({
      id: randomUUID(),
      tenantId,
      name: office.name,
      phone: office.phone,
      email: office.email,
      keywords: office.keywords,
      location: office.location ?? null,
      hours: office.hours,
    });
    created++;
  }

  console.log(`Offices added: ${created}`);
  console.log(`Offices skipped: ${skipped}`);

  await invalidateDeptCache(redis, tenantId);
  console.log("Department cache invalidated.");
}

seedUtrgv()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await client.end();
    redis.disconnect();
  });
