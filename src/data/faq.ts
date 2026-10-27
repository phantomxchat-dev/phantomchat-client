import { Terminal, Inbox, Lock, Zap, Scale } from "lucide-react";

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

export interface FaqCategory {
  id: "terminal" | "inboxes" | "controls" | "pro" | "legal";
  title: string;
  description: string;
  icon: typeof Terminal;
  items: FaqItem[];
}

export const faqCategories: FaqCategory[] = [
  {
    id: "terminal",
    title: "Terminal & Setup",
    description:
      "Pseudonymous Device IDs, Sync Browser pairing, PWA installation, terminal settings, and privacy.",
    icon: Terminal,
    items: [
      {
        id: "q1",
        question:
          "What is my Device ID (TR-XXXXX), and why is it identical across browsers on my phone?",
        answer:
          "Your Device ID is a pseudonymous code PhantomChat uses to link your browser to your Pro access. It may be the same across browsers on your phone, but this isn’t guaranteed. Use Sync Browser to copy the same ID to another browser. If you have Pro, keep a synced copy in another browser. If all copies are lost and you don’t have a saved copy, neither you nor our team can recover the ID or the Pro access linked to it.",
      },
      {
        id: "q2",
        question: "How do I install Phantom Chat as a Web App (PWA)?",
        answer:
          'Open the Phantom Navigation menu in /terminal and select "Install Web App (PWA)". This adds Phantom Chat directly to your device home screen for launcher access.',
      },
      {
        id: "q3",
        question: "How do Sound Alerts work in my terminal settings?",
        answer:
          'Toggling Sound Alerts on or off in /terminal manages audio pings for new messages and invites. Use the "Test alert sound" control to verify output levels.',
      },
      {
        id: "q4",
        question:
          "Will clearing my browser storage affect my local Device ID?",
        answer:
          "Yes. Clearing a browser’s site data can erase its saved Device ID. If another browser still has your ID, use Sync Browser to copy it back. If all copies are lost and you don’t have a saved copy, neither you nor our team can recover it.",
      },
      {
        id: "q5",
        question:
          "Does Phantom Chat collect email addresses, names, or phone numbers?",
        answer:
          "You don’t need to provide a name, email address, or phone number to use PhantomChat’s core features. The service may still process your Device ID, the content you send, and technical information needed to operate and protect the service. See the Privacy Notice for details.",
      },
      {
        id: "q6",
        question: "Does the app track or store my real-world GPS location?",
        answer:
          "PhantomChat does not request access to your device’s GPS location. Like other internet services, the network or hosting providers involved in connecting to the site may be able to infer an approximate location from connection information such as an IP address.",
      },
      {
        id: "q31",
        question:
          "How do I update Phantom Chat without clearing my browser data?",
        answer:
          "Use the update notice or the Check for Updates control to load the latest version. You do not need to clear your browser data. Your saved Device ID should remain in this browser. If you have Pro, keep a synced copy of your Device ID in another browser in case you later clear this browser’s site data.",
      },
    ],
  },
  {
    id: "inboxes",
    title: "Inboxes & Lobbies",
    description:
      "Transmission inbox, global broadcasts, feedback forum, and contact connections.",
    icon: Inbox,
    items: [
      {
        id: "q7",
        question: "What is the Transmission Inbox (/inbox) used for?",
        answer:
          "The Transmission Inbox handles direct room invitations, contact requests, proposal notes, and system updates sent directly to your Device ID.",
      },
      {
        id: "q8",
        question: "How do I send a direct invite or message in the Inbox?",
        answer:
          'Open /inbox, input your peer\'s Recipient Device ID, write your message or room code, and tap "Send Message".',
      },
      {
        id: "q9",
        question: "What is the Global Lobby (/globallobby)?",
        answer:
          "The Global Lobby is a public broadcast feed where users can share open, temporary announcements across the network.",
      },
      {
        id: "q10",
        question:
          "How does the 60-second broadcast decay work in the Global Lobby?",
        answer:
          "Global Lobby messages are removed from the active feed after about 60 seconds. This does not prevent someone from copying or saving a message, and it is not a guarantee that all technical records or temporary copies are immediately erased.",
      },
      {
        id: "q11",
        question: "What is the Ideas & Proposals forum (/ideas)?",
        answer:
          "/ideas is a community feedback page where users can browse, search, and submit project proposals across categories like Community, Productivity, and Media.",
      },
      {
        id: "q12",
        question: "How do Verified Contacts (/friends) work?",
        answer:
          "You can send handshake requests using a peer's Device ID in /friends. You can also toggle your online Presence visibility (Online/Hidden) or block peers at any time.",
      },
    ],
  },
  {
    id: "controls",
    title: "In-Room Controls",
    description:
      "In-memory chunked file streaming, steganography cover mode, panic decoy switch, and room lifespans.",
    icon: Lock,
    items: [
      {
        id: "q13",
        question: 'What is "In-Memory File Streaming" inside a chat room?',
        answer:
          "Files are sent in smaller pieces to help deliver them through the room. “In-memory” describes a transfer method; it does not guarantee that every file stays only in your browser or is never temporarily processed or stored by supporting services. Only share files with people you trust.",
      },
      {
        id: "q14",
        question: 'How does "Stego Cover Mode" hide text inside photos?',
        answer:
          "Enabling Stego Cover Mode embeds your hidden text directly into the visual pixel bits of a cover photo. To outside observers, it appears as a standard image.",
      },
      {
        id: "q15",
        question: "How do I reveal hidden text inside a steganographic image?",
        answer:
          "When an image sent in Stego Cover Mode arrives in chat, tap the [STEGO PAYLOAD DETECTED] badge to extract and view the concealed message.",
      },
      {
        id: "q16",
        question: "What happens when I trigger Panic / Decoy Mode?",
        answer:
          "Tapping the Panic icon or entering your duress PIN unmounts active chat keys from memory and immediately switches the screen to a functional calculator decoy interface.",
      },
      {
        id: "q17",
        question: "How do I invite a friend to an active chat room?",
        answer:
          'Tap the "Copy Code" button in your active room header to copy the 6-digit room code, then send that code directly to your participant.',
      },
      {
        id: "q18",
        question: "What happens when a room's lifespan countdown timer reaches zero?",
        answer:
          "The room closes and participants can no longer use it through PhantomChat. This does not erase copies that participants saved, and it does not guarantee the immediate removal of every technical record or temporary copy.",
      },
    ],
  },
  {
    id: "pro",
    title: "Pro Clearance",
    description:
      "Extended timers, priority bandwidth, media transmissions, and device binding.",
    icon: Zap,
    items: [
      {
        id: "q19",
        question:
          'What is "Phantom Pro Clearance" (/premium) and what features does it include?',
        answer:
          "Phantom Pro provides the features listed on the Premium page. The current offer is $9.99 USD for 30 days and does not renew automatically. Pro access is linked to your Device ID, so keep a synced copy of that ID in another browser.",
      },
      {
        id: "q20",
        question:
          "Is media sharing completely unlimited for all file types with Pro Clearance?",
        answer:
          "No. Pro does not necessarily remove every file-type, size, or usage limit. Check the Premium page and the upload controls for the current supported formats and limits.",
      },
      {
        id: "q21",
        question: 'What is "Persistent Device DNA Memory Binding"?',
        answer:
          "Your Pro access is linked to your Device ID rather than to a user account. Use Sync Browser to copy that ID to another browser. If all copies are lost and you don’t have a saved copy, neither you nor our team can recover the ID or the Pro access linked to it.",
      },
      {
        id: "q22",
        question:
          "How are payments processed, and does Pro Clearance auto-renew?",
        answer:
          "Upgrades are processed securely via the NOWPayments checkout protocol using cryptocurrency. It operates on a strict 30-day non-recurring duration, so you manually renew only when you choose to extend your access.",
      },
    ],
  },
  {
    id: "legal",
    title: "Legal & Safety",
    description:
      "Acceptable use rules, zero-log compliance, reporting tools, ownership, and age requirements.",
    icon: Scale,
    items: [
      {
        id: "q23",
        question: "What are the rules under the Terms of Service?",
        answer:
          "Users must use Phantom Chat lawfully. Using the network for illegal acts, harassment, exploitation, or malware distribution is strictly prohibited and results in immediate access termination.",
      },
      {
        id: "q24",
        question:
          "Can law enforcement request my past chat logs or message history?",
        answer:
          "PhantomChat does not promise that no records exist. What may be available depends on what information is retained by PhantomChat and its service providers, and on copies users may have saved. We handle valid legal requests according to applicable law. See the Privacy Notice for information about data handling.",
      },
      {
        id: "q25",
        question: "How do I report abuse or safety violations?",
        answer:
          "Tap the Report action on any message in chat or email our trust team at support@phantomchat.space.",
      },
      {
        id: "q26",
        question:
          "Is Phantom Chat compliant with global privacy standards (GDPR / CCPA)?",
        answer:
          "Not requiring a name or email address does not, by itself, establish compliance with a privacy law. What rules apply depends on the service and the data involved. See the Privacy Notice for information about data handling and privacy requests.",
      },
      {
        id: "q27",
        question: "Who owns content shared in rooms or posted on the Ideas page?",
        answer:
          "You remain responsible for the content you share and for having the rights needed to share it. People who can view your content may be able to copy or save it. See the Terms of Service for details about permissions involved in using PhantomChat.",
      },
      {
        id: "q28",
        question: "Am I responsible for media shared in chat rooms?",
        answer:
          "Yes. Users are individually responsible for ensuring that all files shared over ephemeral rooms comply with local laws and copyright regulations.",
      },
      {
        id: "q29",
        question: "What is the minimum age requirement to use Phantom Chat?",
        answer:
          "You must meet the minimum age stated in the Terms of Service and any higher age requirement that applies where you live. If you do not meet those requirements, do not use PhantomChat.",
      },
      {
        id: "q30",
        question: "How do I contact technical support or report bugs?",
        answer:
          "Contact our engineering team directly at support@phantomchat.space for assistance or bug reports.",
      },
    ],
  },
];
