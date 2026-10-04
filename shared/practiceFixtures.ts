/** Universal fictional tutorial records. Never production IDs. */
export const PRACTICE_ARTIST = "practice-artist";
export const PRACTICE_CLIENT = "practice-client";
export const PRACTICE_CLIENTS = [
  {
    id: PRACTICE_CLIENT,
    name: "Alex Taylor",
    role: "client",
    city: "Brisbane",
    email: "alex@example.test",
    phone: "0400 000 000",
    birthday: "1990-10-15",
    bookings: 3,
    lifetimePaid: 300000,
    inactiveDays: 45,
    birthdayMonth: 10,
  },
  {
    id: "practice-sam",
    name: "Sam Chen",
    role: "client",
    city: "Sydney",
    email: "sam@example.test",
    bookings: 1,
    lifetimePaid: 50000,
    inactiveDays: 100,
    birthdayMonth: 1,
  },
  {
    id: "practice-jordan",
    name: "Jordan Reid",
    role: "client",
    city: "Auckland",
    email: "jordan@example.test",
    bookings: 5,
    lifetimePaid: 500000,
    inactiveDays: 10,
    birthdayMonth: 10,
  },
];
export const PRACTICE_SETTINGS = {
  artistId: PRACTICE_ARTIST,
  businessName: "Practice studio",
  businessAddress: "Brisbane (fictional)",
  subscriptionTier: "free",
  depositPercentage: 25,
  services: JSON.stringify([
    { name: "Full-day tattoo", duration: 480, price: 1000, sittings: 1 },
    { name: "Half-day tattoo", duration: 240, price: 600, sittings: 1 },
    { name: "Sleeve project", duration: 480, price: 1000, sittings: 6 },
  ]),
  workSchedule: JSON.stringify(
    Object.fromEntries(
      [
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
        "sunday",
      ].map((day, i) => [
        day,
        {
          enabled: i < 5,
          startTime: "09:00",
          endTime: "17:00",
          type: "work",
          breaks: [],
        },
      ])
    )
  ),
};
export const PRACTICE_ARTIST_PROFILE = {
  id: PRACTICE_ARTIST,
  role: "artist",
  name: "Practice Artist",
  email: "artist@example.test",
  hasCompletedOnboarding: 1,
};
