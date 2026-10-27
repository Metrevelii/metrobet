import type { LocalizedText, PromoBlock, Promotion } from '@metrobet/contracts';

const image = (slug: string) => ({
  desktop: `/promotions/${slug}-desktop.svg`,
  mobile: `/promotions/${slug}-mobile.svg`,
});

const intro = (body: LocalizedText): PromoBlock => ({
  id: 'intro',
  type: 'richText',
  title: null,
  body,
});
const terms = (body: LocalizedText): PromoBlock => ({ id: 'terms', type: 'terms', body });

/** Full showcase page: every block type in a typical order. */
const tournamentPage: PromoBlock[] = [
  {
    id: 'join',
    type: 'optIn',
    title: { ka: 'შეუერთდი ტურნირს', en: 'Join the tournament', ru: 'Присоединяйтесь к турниру' },
    body: {
      ka: 'ქულები მხოლოდ რეგისტრაციის შემდეგ დაგერიცხება.',
      en: 'Points only count after you join.',
      ru: 'Очки начисляются только после регистрации в турнире.',
    },
  },
  {
    id: 'countdown',
    type: 'countdown',
    title: { ka: 'ტურნირის დასრულებამდე', en: 'Tournament ends in', ru: 'До конца турнира' },
  },
  {
    id: 'steps',
    type: 'steps',
    title: { ka: 'როგორ მივიღო მონაწილეობა', en: 'How to take part', ru: 'Как участвовать' },
    items: [
      {
        title: { ka: 'შეუერთდი', en: 'Join', ru: 'Присоединяйтесь' },
        text: {
          ka: 'დააჭირე ღილაკს „მონაწილეობა“.',
          en: 'Press the Join button on this page.',
          ru: 'Нажмите кнопку «Участвовать» на этой странице.',
        },
      },
      {
        title: { ka: 'ითამაშე', en: 'Play', ru: 'Играйте' },
        text: {
          ka: 'ითამაშე მონაწილე სლოტებზე მინიმუმ 0.50 ₾ ფსონით.',
          en: 'Play participating slots with bets of 0.50 ₾ or more.',
          ru: 'Играйте в слоты-участники со ставкой от 0.50 ₾.',
        },
      },
      {
        title: { ka: 'აიწიე', en: 'Climb', ru: 'Поднимайтесь' },
        text: {
          ka: 'ყოველი ტრიალი გაძლევს ქულებს ლიდერბორდზე.',
          en: 'Every spin earns points on the leaderboard.',
          ru: 'Каждое вращение приносит очки в рейтинге.',
        },
      },
    ],
  },
  intro({
    ka: 'ყოველკვირეული ტურნირი მონაწილე სლოტებზე. ყოველი ტრიალი გაძლევს ქულებს.\n\nკვირის ბოლოს საპრიზო ფონდი ნაწილდება ლიდერბორდის ტოპ 100 მოთამაშეს შორის.',
    en: 'A weekly tournament on participating slots. Every spin earns you points.\n\nAt the end of the week the prize pool is shared among the top 100 players on the leaderboard.',
    ru: 'Еженедельный турнир на слотах-участниках. Каждое вращение приносит очки.\n\nВ конце недели призовой фонд делится между топ-100 игроками рейтинга.',
  }),
  {
    id: 'prizes',
    type: 'prizes',
    title: { ka: 'პრიზები', en: 'Prizes', ru: 'Призы' },
    items: [
      {
        label: { ka: '1 ადგილი', en: '1st place', ru: '1 место' },
        prize: { ka: '10 000 ₾', en: '10,000 ₾', ru: '10 000 ₾' },
      },
      {
        label: { ka: '2 ადგილი', en: '2nd place', ru: '2 место' },
        prize: { ka: '5 000 ₾', en: '5,000 ₾', ru: '5 000 ₾' },
      },
      {
        label: { ka: '3 ადგილი', en: '3rd place', ru: '3 место' },
        prize: { ka: '2 500 ₾', en: '2,500 ₾', ru: '2 500 ₾' },
      },
      {
        label: { ka: '4–10 ადგილი', en: '4th–10th', ru: '4–10 место' },
        prize: { ka: '1 000 ₾', en: '1,000 ₾', ru: '1 000 ₾' },
      },
      {
        label: { ka: '11–100 ადგილი', en: '11th–100th', ru: '11–100 место' },
        prize: { ka: '250 ₾', en: '250 ₾', ru: '250 ₾' },
      },
    ],
  },
  {
    id: 'faq',
    type: 'faq',
    title: { ka: 'ხშირი კითხვები', en: 'FAQ', ru: 'Частые вопросы' },
    items: [
      {
        question: {
          ka: 'რომელი სლოტები მონაწილეობს?',
          en: 'Which slots take part?',
          ru: 'Какие слоты участвуют?',
        },
        answer: {
          ka: 'ყველა სლოტი Slots განყოფილებაში, გარდა ჯეკპოტ თამაშებისა.',
          en: 'Every slot in the Slots section except jackpot games.',
          ru: 'Все слоты в разделе Slots, кроме джекпот-игр.',
        },
      },
      {
        question: {
          ka: 'როდის ჩაირიცხება პრიზი?',
          en: 'When are prizes paid?',
          ru: 'Когда начисляются призы?',
        },
        answer: {
          ka: 'ორშაბათს, ტურნირის დასრულებიდან 24 საათში.',
          en: 'On Monday, within 24 hours of the tournament ending.',
          ru: 'В понедельник, в течение 24 часов после окончания турнира.',
        },
      },
    ],
  },
  terms({
    ka: 'მინიმალური ფსონი 0.50 ₾.\nპრიზები ჩაირიცხება ორშაბათს.',
    en: 'Minimum bet 0.50 ₾.\nPrizes are credited on Monday.',
    ru: 'Минимальная ставка 0.50 ₾.\nПризы начисляются в понедельник.',
  }),
];

/** Prize wheel demo: 50 ₾ on slots = 1 spin, every segment wins free spins. */
const wheelPage = (freeSpinsGame: string): PromoBlock[] => [
  {
    id: 'join',
    type: 'optIn',
    title: { ka: 'შეუერთდი ბორბალს', en: 'Join the wheel', ru: 'Присоединяйтесь к колесу' },
    body: {
      ka: 'დატრიალებები გროვდება მხოლოდ რეგისტრაციის შემდეგ.',
      en: 'Spins only build up after you join.',
      ru: 'Вращения копятся только после регистрации в акции.',
    },
  },
  {
    id: 'wheel',
    type: 'wheel',
    title: { ka: 'ბედის ბორბალი', en: 'Wheel of fortune', ru: 'Колесо фортуны' },
    earn: { stepAmount: 50_00, gameTypes: ['slot'] },
    freeSpinsGame,
    segments: [5, 10, 5, 20, 5, 10, 5, 50].map((freeSpins) => ({
      freeSpins,
      weight: Math.round(1000 / freeSpins),
    })),
  },
  {
    id: 'steps',
    type: 'steps',
    title: { ka: 'როგორ მუშაობს', en: 'How it works', ru: 'Как это работает' },
    items: [
      {
        title: { ka: 'შეუერთდი', en: 'Join', ru: 'Присоединяйтесь' },
        text: {
          ka: 'დააჭირე ღილაკს „მონაწილეობა“.',
          en: 'Press Join at the top of this page.',
          ru: 'Нажмите «Участвовать» вверху страницы.',
        },
      },
      {
        title: { ka: 'ითამაშე სლოტები', en: 'Play slots', ru: 'Играйте в слоты' },
        text: {
          ka: 'ყოველი 50 ₾ ფსონი სლოტებზე = 1 დატრიალება.',
          en: 'Every 50 ₾ wagered on slots = 1 spin.',
          ru: 'Каждые 50 ₾ ставок в слотах = 1 вращение.',
        },
      },
      {
        title: { ka: 'დაატრიალე', en: 'Spin', ru: 'Крутите' },
        text: {
          ka: 'ყოველი დატრიალება იგებს უფასო ტრიალებს.',
          en: 'Every spin wins free spins.',
          ru: 'Каждое вращение приносит фриспины.',
        },
      },
    ],
  },
  terms({
    ka: 'ითვლება მხოლოდ რეალური ფულის ფსონები სლოტებზე.\nუფასო ტრიალები მოქმედებს 7 დღე.',
    en: 'Only real-money bets on slots count.\nFree spins are valid for 7 days.',
    ru: 'Учитываются только ставки на реальные деньги в слотах.\nФриспины действуют 7 дней.',
  }),
];

/**
 * Mock catalogue used until promotions are stored in Postgres and managed from the backoffice.
 * Image paths are served by apps/web/public; real ones will be absolute CDN URLs.
 */
/** `freeSpinsGame`: a slot slug from the synced catalogue (it depends on CASINO_AGGREGATOR). */
export const promotionsSeed = (freeSpinsGame: string): Promotion[] => [
  {
    id: 'promo-wheel-of-fortune',
    slug: 'wheel-of-fortune',
    category: 'casino',
    title: { ka: 'ბედის ბორბალი', en: 'Wheel of fortune', ru: 'Колесо фортуны' },
    subtitle: {
      ka: 'ითამაშე სლოტები, დააგროვე დატრიალებები და მოიგე უფასო ტრიალები.',
      en: 'Play slots, collect spins and win free spins.',
      ru: 'Играйте в слоты, копите вращения и выигрывайте фриспины.',
    },
    ctaLabel: { ka: 'დაატრიალე', en: 'Spin the wheel', ru: 'Крутить колесо' },
    ctaHref: null,
    image: image('slots-tournament'),
    blocks: wheelPage(freeSpinsGame),
    placements: ['home', 'casino'],
    sortOrder: 1,
    isActive: true,
    startsAt: null,
    endsAt: null,
  },
  {
    id: 'promo-welcome-bonus',
    slug: 'welcome-bonus',
    category: 'general',
    title: {
      ka: '100% მისასალმებელი ბონუსი 500 ₾-მდე',
      en: '100% welcome bonus up to 500 ₾',
      ru: 'Приветственный бонус 100% до 500 ₾',
    },
    subtitle: {
      ka: 'გააორმაგე პირველი დეპოზიტი და ითამაშე სპორტზე, სლოტებსა და ქრაშზე.',
      en: 'Double your first deposit and play sports, slots and crash games.',
      ru: 'Удвойте первый депозит и играйте в спорт, слоты и краш-игры.',
    },
    ctaLabel: { ka: 'მიიღე ბონუსი', en: 'Claim bonus', ru: 'Получить бонус' },
    ctaHref: null,
    blocks: [
      intro({
        ka: 'დარეგისტრირდი Metrobet-ზე და მიიღე 100% ბონუსი პირველ დეპოზიტზე, მაქსიმუმ 500 ₾.\n\nბონუსი ავტომატურად ჩაგერიცხება დეპოზიტისთანავე და შეგიძლია გამოიყენო ნებისმიერ განყოფილებაში.',
        en: 'Sign up at Metrobet and get a 100% bonus on your first deposit, up to 500 ₾.\n\nThe bonus is credited automatically as soon as your deposit lands and can be used across every section.',
        ru: 'Зарегистрируйтесь на Metrobet и получите бонус 100% на первый депозит, до 500 ₾.\n\nБонус зачисляется автоматически сразу после депозита и действует во всех разделах.',
      }),
      terms({
        ka: 'მინიმალური დეპოზიტი 20 ₾.\nბონუსს აქვს 10x ფსონის მოთხოვნა.\nბონუსი მოქმედებს 14 დღის განმავლობაში.',
        en: 'Minimum deposit 20 ₾.\nThe bonus has a 10x wagering requirement.\nThe bonus is valid for 14 days.',
        ru: 'Минимальный депозит 20 ₾.\nБонус нужно отыграть с вейджером x10.\nБонус действует 14 дней.',
      }),
    ],
    image: image('welcome-bonus'),
    placements: ['home', 'sports', 'casino'],
    sortOrder: 10,
    isActive: true,
    startsAt: null,
    endsAt: null,
  },
  {
    id: 'promo-accumulator-boost',
    slug: 'accumulator-boost',
    category: 'sports',
    title: {
      ka: 'ექსპრესის ბუსტი 50%-მდე',
      en: 'Accumulator boost up to 50%',
      ru: 'Буст экспресса до 50%',
    },
    subtitle: {
      ka: 'რაც მეტი მოვლენა, მით მეტი მოგება. 4+ არჩევანიან ექსპრესებზე.',
      en: 'More selections, bigger wins. On accumulators with 4+ selections.',
      ru: 'Больше событий, больше выигрыш. Для экспрессов от 4 событий.',
    },
    ctaLabel: { ka: 'დადე ფსონი', en: 'Bet now', ru: 'Сделать ставку' },
    ctaHref: '/sports',
    blocks: [
      intro({
        ka: 'დადე ექსპრესი 4 ან მეტი არჩევანით და მოგებას დაემატება ბუსტი 5%-დან 50%-მდე.\n\nბუსტი იზრდება ყოველ დამატებით არჩევანზე.',
        en: 'Place an accumulator with 4 or more selections and get a 5% to 50% boost on your winnings.\n\nThe boost grows with every extra selection.',
        ru: 'Поставьте экспресс из 4 и более событий и получите буст выигрыша от 5% до 50%.\n\nБуст растёт с каждым дополнительным событием.',
      }),
      terms({
        ka: 'თითოეული არჩევანის მინიმალური კოეფიციენტი 1.30.\nბუსტის მაქსიმალური თანხა 2 000 ₾.',
        en: 'Minimum odds of 1.30 per selection.\nMaximum boost payout 2,000 ₾.',
        ru: 'Минимальный коэффициент на событие 1.30.\nМаксимальная сумма буста 2 000 ₾.',
      }),
    ],
    image: image('accumulator-boost'),
    placements: ['home', 'sports', 'live'],
    sortOrder: 20,
    isActive: true,
    startsAt: null,
    endsAt: null,
  },
  {
    id: 'promo-slots-tournament',
    slug: 'slots-tournament',
    category: 'casino',
    title: {
      ka: 'სლოტების ტურნირი: 50 000 ₾ საპრიზო ფონდი',
      en: 'Slots tournament: 50,000 ₾ prize pool',
      ru: 'Турнир по слотам: призовой фонд 50 000 ₾',
    },
    subtitle: {
      ka: 'ითამაშე მონაწილე სლოტებზე, დააგროვე ქულები და აიწიე ლიდერბორდზე.',
      en: 'Play participating slots, collect points and climb the leaderboard.',
      ru: 'Играйте в слоты-участники, набирайте очки и поднимайтесь в рейтинге.',
    },
    ctaLabel: { ka: 'შეუერთდი', en: 'Join now', ru: 'Участвовать' },
    ctaHref: null,
    blocks: tournamentPage,
    image: image('slots-tournament'),
    placements: ['home', 'casino'],
    sortOrder: 30,
    isActive: true,
    startsAt: null,
    endsAt: '2026-12-31T19:59:59.000Z',
  },
  {
    id: 'promo-crash-cashback',
    slug: 'crash-cashback',
    category: 'crash',
    title: {
      ka: '10% ქეშბექი ქრაშ თამაშებზე',
      en: '10% cashback on crash games',
      ru: 'Кэшбэк 10% в краш-играх',
    },
    subtitle: {
      ka: 'ყოველ ორშაბათს დაგიბრუნებთ კვირის წაგების 10%-ს.',
      en: 'Every Monday we return 10% of your weekly losses.',
      ru: 'Каждый понедельник возвращаем 10% недельного проигрыша.',
    },
    ctaLabel: { ka: 'ითამაშე', en: 'Play now', ru: 'Играть' },
    ctaHref: '/crash',
    blocks: [
      intro({
        ka: 'ითამაშე ქრაშ თამაშები მთელი კვირის განმავლობაში და ორშაბათს მიიღე წაგების 10% ქეშბექის სახით.',
        en: 'Play crash games all week and get 10% of your net losses back as cashback on Monday.',
        ru: 'Играйте в краш-игры всю неделю и получите 10% чистого проигрыша кэшбэком в понедельник.',
      }),
      terms({
        ka: 'მაქსიმალური ქეშბექი 1 000 ₾.\nქეშბექს არ აქვს ფსონის მოთხოვნა.',
        en: 'Maximum cashback 1,000 ₾.\nCashback has no wagering requirement.',
        ru: 'Максимальный кэшбэк 1 000 ₾.\nКэшбэк без вейджера.',
      }),
    ],
    image: image('crash-cashback'),
    placements: ['home', 'crash'],
    sortOrder: 40,
    isActive: true,
    startsAt: null,
    endsAt: null,
  },
  {
    id: 'promo-live-free-bet',
    slug: 'live-free-bet',
    category: 'sports',
    title: {
      ka: '10 ₾ უფასო ფსონი ლაივ ფეხბურთზე',
      en: '10 ₾ free bet on live football',
      ru: 'Фрибет 10 ₾ на лайв-футбол',
    },
    subtitle: {
      ka: 'დადე 3 ლაივ ფსონი კვირაში და მიიღე უფასო ფსონი.',
      en: 'Place 3 live bets in a week and get a free bet.',
      ru: 'Сделайте 3 лайв-ставки за неделю и получите фрибет.',
    },
    ctaLabel: { ka: 'ლაივზე გადასვლა', en: 'Go live', ru: 'Перейти в лайв' },
    ctaHref: '/live',
    blocks: [
      intro({
        ka: 'დადე სულ მცირე 3 ლაივ ფსონი ფეხბურთზე ერთი კვირის განმავლობაში და მიიღე 10 ₾ უფასო ფსონი.',
        en: 'Place at least 3 live football bets within one week and receive a 10 ₾ free bet.',
        ru: 'Сделайте минимум 3 лайв-ставки на футбол за неделю и получите фрибет 10 ₾.',
      }),
      terms({
        ka: 'თითოეული ფსონი მინიმუმ 5 ₾.\nუფასო ფსონი მოქმედებს 7 დღე.',
        en: 'Each bet must be at least 5 ₾.\nThe free bet is valid for 7 days.',
        ru: 'Каждая ставка от 5 ₾.\nФрибет действует 7 дней.',
      }),
    ],
    image: image('live-free-bet'),
    placements: ['home', 'sports', 'live'],
    sortOrder: 50,
    isActive: true,
    startsAt: null,
    endsAt: null,
  },
  {
    id: 'promo-summer-drop',
    slug: 'summer-drop',
    category: 'casino',
    title: { ka: 'ზაფხულის დროპი', en: 'Summer drop', ru: 'Летний дроп' },
    subtitle: {
      ka: 'დასრულებული აქცია.',
      en: 'Finished campaign.',
      ru: 'Завершённая акция.',
    },
    ctaLabel: { ka: 'ითამაშე', en: 'Play', ru: 'Играть' },
    ctaHref: null,
    blocks: [
      intro({ ka: 'დასრულდა.', en: 'Finished.', ru: 'Завершено.' }),
      terms({ ka: '—', en: '—', ru: '—' }),
    ],
    image: image('slots-tournament'),
    placements: ['home', 'casino'],
    sortOrder: 5,
    isActive: true,
    startsAt: '2026-06-01T00:00:00.000Z',
    endsAt: '2026-08-31T20:00:00.000Z',
  },
];
