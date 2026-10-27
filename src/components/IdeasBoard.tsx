import React, { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { 
  ArrowLeft, Lightbulb, Check, Plus, Search, Bookmark, Users, Shield, 
  Trash2, Edit3, ExternalLink, MessageSquare, Filter, Clock, Send, 
  X, AlertTriangle, ShieldAlert, CheckCircle, RefreshCw, FileText, Lock,
  ChevronDown, ChevronUp
} from "lucide-react";
import { FEATURED_SUBMISSIONS, SeedIdea } from "../data/featuredSubmissions";

// Firestore emulation shim using Express REST API
export const db = {};
export const collection = (_dbInstance: any, path: string) => ({ path });
export const doc = (_dbInstance: any, collectionPath: string, docId?: string) => ({ path: `${collectionPath}/${docId || ''}` });
export const query = (colRef: any, ..._constraints: any[]) => ({ colRef, constraints: _constraints });
export const where = (field: string, op: string, value: any) => ({ field, op, value });

export const getDoc = async (docRef: any) => {
  const parts = docRef.path.split('/');
  const col = parts[0];
  const id = parts[1];
  if (col === 'ideas') {
    try {
      const res = await fetch('/api/ideas');
      const data = await res.json();
      const found = (data.ideas || []).find((i: any) => i.id === id);
      return { exists: () => !!found, data: () => found };
    } catch (e) {}
  }
  return { exists: () => false, data: () => null };
};

export const setDoc = async (docRef: any, data: any, _options?: any) => {
  const parts = docRef.path.split('/');
  const col = parts[0];
  try {
    if (col === 'ideas') {
      await fetch('/api/ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
    } else if (col === 'ideas_replies') {
      await fetch(`/api/ideas/${data.ideaId}/replies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
    } else if (col === 'proposals') {
      await fetch('/api/proposals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
    } else if (col === 'saved_ideas') {
      await fetch('/api/ideas/saved', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceCode: data.deviceCode, ideaId: data.ideaId, action: 'save' })
      });
    }
  } catch (e) {}
  return true;
};

export const updateDoc = async (docRef: any, data: any) => {
  const parts = docRef.path.split('/');
  const col = parts[0];
  const id = parts[1];
  try {
    if (col === 'proposals') {
      await fetch(`/api/proposals/${id}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: data.status === 'accepted' ? 'accept' : data.status === 'declined' ? 'decline' : 'update', ...data })
      });
    } else if (col === 'saved_ideas') {
      await fetch('/api/ideas/saved', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceCode: data.deviceCode, ideaId: data.ideaId, action: 'update' })
      });
    }
  } catch (e) {}
  return true;
};

export const deleteDoc = async (docRef: any) => {
  const parts = docRef.path.split('/');
  const col = parts[0];
  try {
    if (col === 'saved_ideas') {
      // parts[1] is deviceCode_ideaId
      const [, ideaId] = parts[1].split('_');
      // We can also trigger remove if needed
    }
  } catch (e) {}
  return true;
};

export const onSnapshot = (queryRef: any, callback: (snap: any) => void, _errorCallback?: (err: any) => void) => {
  let active = true;
  const path = queryRef.colRef ? queryRef.colRef.path : queryRef.path;

  const poll = async () => {
    if (!active) return;
    try {
      if (path === 'ideas') {
        const res = await fetch('/api/ideas');
        const data = await res.json();
        if (data && Array.isArray(data.ideas)) {
          const docs = data.ideas.map((item: any) => ({
            id: item.id,
            data: () => item,
            exists: () => true
          }));
          callback({ forEach: (fn: any) => docs.forEach(fn) });
        }
      } else if (path === 'saved_ideas') {
        callback({ forEach: (fn: any) => {} });
      } else if (path === 'proposals') {
        const res = await fetch('/api/proposals');
        const data = await res.json();
        if (data && Array.isArray(data.proposals)) {
          const docs = data.proposals.map((item: any) => ({
            id: item.id,
            data: () => item,
            exists: () => true
          }));
          callback({ forEach: (fn: any) => docs.forEach(fn) });
        }
      } else if (path === 'ideas_replies') {
        // If queryRef has where constraint for ideaId, we can fetch replies
        const ideaIdConstraint = queryRef.constraints?.find((c: any) => c.field === 'ideaId');
        if (ideaIdConstraint && ideaIdConstraint.value) {
          const res = await fetch(`/api/ideas/${ideaIdConstraint.value}/replies`);
          const data = await res.json();
          if (data && Array.isArray(data.replies)) {
            const docs = data.replies.map((item: any) => ({
              id: item.id,
              data: () => item,
              exists: () => true
            }));
            callback({ forEach: (fn: any) => docs.forEach(fn) });
          }
        }
      }
    } catch (e) {}
    if (active) {
      setTimeout(poll, 3500);
    }
  };

  poll();

  return () => {
    active = false;
  };
};

// Extended interface representing the live database Idea state
interface LiveIdea extends SeedIdea {
  userHasSaved?: boolean;
}

interface IdeasBoardProps {
  myDna: string;
  myAlias: string;
  onBack: () => void;
  navigateTo: (
    route: "landing" | "gate" | "chat" | "world-chat" | "globallobby" | "faq" | "premium" | "inbox" | "ideas" | "friends",
    optRoomCode?: string
  ) => void;
  onNegotiate?: (neg: {
    recipientDna: string;
    ideaId: string;
    ideaTitle: string;
    subject: string;
    body: string;
    conversationType: "DISCUSS" | "CHALLENGE" | "COLLABORATE" | "NEGOTIATE";
  }) => void;
}

export function IdeasBoard({ myDna, myAlias, onBack, navigateTo, onNegotiate }: IdeasBoardProps) {
  // Navigation tabs
  const [activeTab, setActiveTab] = useState<"BROWSE" | "POST" | "MY_TRANSMISSIONS">("BROWSE");
  
  // Filtering & Search states
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
  const [showOnlyFeatured, setShowOnlyFeatured] = useState(false);
  const [expandedSourceIds, setExpandedSourceIds] = useState<string[]>([]);

  const toggleSourceDetails = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setExpandedSourceIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const formatDateDMY = (ts: number | string | Date | undefined) => {
    if (!ts) return "DD/MM/YYYY";
    const d = new Date(ts);
    if (isNaN(d.getTime())) return "DD/MM/YYYY";
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const formatStatusLabel = (status: string | undefined) => {
    if (!status) return "";
    return (status || "").replace(/_/g, " ").trim().toUpperCase();
  };

  // Ideas & Comments State
  const [ideas, setIdeas] = useState<LiveIdea[]>([]);
  const [savedIdeaIds, setSavedIdeaIds] = useState<Set<string>>(new Set());
  const [proposals, setProposals] = useState<any[]>([]);
  const [selectedIdea, setSelectedIdea] = useState<LiveIdea | null>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Keep selectedIdea in sync with real-time updates from ideas list
  useEffect(() => {
    if (selectedIdea) {
      const liveVersion = ideas.find((i) => i.id === selectedIdea.id);
      if (liveVersion) {
        if (
          liveVersion.replyCount !== selectedIdea.replyCount ||
          liveVersion.proposalCount !== selectedIdea.proposalCount ||
          liveVersion.status !== selectedIdea.status ||
          liveVersion.title !== selectedIdea.title ||
          liveVersion.summary !== selectedIdea.summary ||
          liveVersion.problem !== selectedIdea.problem ||
          liveVersion.targetUsers !== selectedIdea.targetUsers ||
          liveVersion.tested !== selectedIdea.tested ||
          liveVersion.updatedAt !== selectedIdea.updatedAt
        ) {
          setSelectedIdea(liveVersion);
        }
      }
    }
  }, [ideas, selectedIdea]);

  // New Idea Form State
  const [formName, setFormName] = useState("");
  const [formCategory, setFormCategory] = useState("STARTUP");
  const [formSummary, setFormSummary] = useState("");
  const [formProblem, setFormProblem] = useState("");
  const [formTargetUsers, setFormTargetUsers] = useState("");
  const [formStage, setFormStage] = useState("NEW IDEA");
  const [formTested, setFormTested] = useState("");
  const [formFeedbackNeeded, setFormFeedbackNeeded] = useState("PRODUCT");
  const [formSupportNeeded, setFormSupportNeeded] = useState("HONEST FEEDBACK");
  const [formCollabMethod, setFormCollabMethod] = useState("DISCUSSION ONLY");
  const [formUrl, setFormUrl] = useState("");
  const [formRoleLabel, setFormRoleLabel] = useState("");
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState(false);

  // Reply Form State
  const [replyText, setReplyText] = useState("");
  const [replyType, setReplyType] = useState<"DISCUSS" | "CHALLENGE" | "COLLABORATE" | "NEGOTIATE">("DISCUSS");

  // Edit Idea State
  const [editingIdea, setEditingIdea] = useState<LiveIdea | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editSummary, setEditSummary] = useState("");
  const [editProblem, setEditProblem] = useState("");
  const [editTargetUsers, setEditTargetUsers] = useState("");

  // Negotiation Proposal Form State
  const [showProposalModal, setShowProposalModal] = useState(false);
  const [proposalContribution, setProposalContribution] = useState("");
  const [proposalRequest, setProposalRequest] = useState("");
  const [proposalRole, setProposalRole] = useState("");
  const [proposalNextStep, setProposalNextStep] = useState("");
  const [proposalTimeframe, setProposalTimeframe] = useState("");
  const [proposalOwnership, setProposalOwnership] = useState("");
  const [proposalError, setProposalError] = useState("");
  const [proposalSuccess, setProposalSuccess] = useState(false);

  const [counteringProposal, setCounteringProposal] = useState<any | null>(null);

  // In-app Report Dialog State (replaces window.prompt & window.alert for sandboxed iframe compatibility)
  const [reportTarget, setReportTarget] = useState<{ id: string; type: "IDEA" | "REPLY"; title?: string } | null>(null);
  const [reportReason, setReportReason] = useState("SPAM");
  const [reportExplanation, setReportExplanation] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportResult, setReportResult] = useState<{ reference: string; status: string } | null>(null);
  const [reportError, setReportError] = useState("");

  // In-app Confirmation Dialog State
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    onConfirm: () => void;
  } | null>(null);

  // Self-negotiate feedback notice
  const [selfNegotiateNotice, setSelfNegotiateNotice] = useState(false);

  // Categories defined in user specification
  const CATEGORIES = [
    "STARTUP", "PRODUCT", "APP OR WEBSITE", "APP REVIEW", "EDUCATION", "SOCIAL IMPACT", 
    "FINTECH CONCEPT", "CREATIVE PROJECT", "CONTENT OR MEDIA", 
    "LOCAL BUSINESS", "E-COMMERCE", "HEALTH AND FITNESS", "COMMUNITY", 
    "CAREER AND PRODUCTIVITY", "MOBILE APP", "OTHER"
  ];

  // Dynamically compute unique categories from loaded ideas plus core categories
  const dynamicCategories = useMemo(() => {
    const coreSet = new Set(CATEGORIES);
    
    ideas.forEach((idea) => {
      if (idea.category && idea.category.trim()) {
        coreSet.add(idea.category.trim().toUpperCase());
      }
    });
    
    return Array.from(coreSet).sort((a, b) => a.localeCompare(b));
  }, [ideas]);

  // Feedback types in user specification
  const FEEDBACK_TYPES = [
    "PRODUCT", "UX", "TECHNICAL", "MARKETING", "PRICING", "GROWTH", 
    "CUSTOMER DISCOVERY", "CASH FLOW", "LIQUIDITY", "ROI", "RISK", "GENERAL DISCUSSION"
  ];

  // Support types in user specification
  const SUPPORT_TYPES = [
    "HONEST FEEDBACK", "CO-FOUNDER", "DESIGNER", "DEVELOPER", "MARKETING", 
    "CUSTOMERS", "DISTRIBUTION", "SALES STRATEGY", "INVESTOR FEEDBACK", "GENERAL DISCUSSION"
  ];

  // Collaboration Methods
  const COLLAB_METHODS = [
    "DISCUSSION ONLY", "OPEN TO COLLABORATION", "LOOKING FOR A CO-FOUNDER", 
    "OPEN TO NEGOTIATION", "REQUESTING PRODUCT REVIEW"
  ];

  // Seed featured ideas idempotently
  const seedFeaturedCommunityIdeas = async () => {
    try {
      console.log("[SEED] Initializing Ideas collection with featured community ideas...");
      for (const sub of FEATURED_SUBMISSIONS) {
        const docRef = doc(db, "ideas", sub.id);
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) {
          console.log(`[SEED] Seeding missing idea ${sub.id}: ${sub.title}`);
          await setDoc(docRef, {
            ...sub,
            replyCount: 0,
            proposalCount: 0,
            savesCount: 0,
            reportsCount: 0,
            isRemoved: false,
            isArchived: false,
            createdAt: sub.createdAt || Date.now(),
            updatedAt: sub.updatedAt || Date.now()
          });
        }
      }
    } catch (err) {
      console.error("[SEED] Error seeding featured ideas:", err);
    }
  };

  // 1. Load ideas and comments in real-time
  useEffect(() => {
    // Run idempotent seed first
    seedFeaturedCommunityIdeas();

    setIsLoading(true);

    // Immediate server hydration from persistent API
    fetch("/api/ideas")
      .then((res) => res.json())
      .then((data) => {
        if (data && Array.isArray(data.ideas) && data.ideas.length > 0) {
          setIdeas((prev) => {
            const map = new Map<string, LiveIdea>();
            for (const item of data.ideas) map.set(item.id, item);
            for (const item of prev) map.set(item.id, item);
            return Array.from(map.values()).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
          });
          setIsLoading(false);
        }
      })
      .catch((err) => console.warn("[IDEAS] API initial fetch notice:", err));

    // Real-time listener for ideas
    const qIdeas = query(collection(db, "ideas"));
    const unsubIdeas = onSnapshot(qIdeas, (snapshot) => {
      const fetchedIdeas: LiveIdea[] = [];
      snapshot.forEach((docSnap) => {
        fetchedIdeas.push({ id: docSnap.id, ...docSnap.data() } as LiveIdea);
      });

      setIdeas((prev) => {
        const map = new Map<string, LiveIdea>();
        for (const item of prev) map.set(item.id, item);
        for (const item of fetchedIdeas) map.set(item.id, item);
        return Array.from(map.values()).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
      });
      setIsLoading(false);
    }, (err) => {
      console.error("Error loading ideas:", err);
      setIsLoading(false);
    });

    return () => unsubIdeas();
  }, []);

  // 2. Load my saved ideas list in real-time
  useEffect(() => {
    if (!myDna) return;
    const qSaves = query(collection(db, "saved_ideas"), where("deviceCode", "==", myDna.toUpperCase()));
    const unsubSaves = onSnapshot(qSaves, (snapshot) => {
      const savedIds = new Set<string>();
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data && data.ideaId) {
          savedIds.add(data.ideaId);
        }
      });
      setSavedIdeaIds(savedIds);
    });

    return () => unsubSaves();
  }, [myDna]);

  // 3. Load active proposals linked to my DNA (either sender or receiver)
  useEffect(() => {
    if (!myDna) return;
    // We cannot easily do an OR query in Firestore without indexing, so we can query all and filter or set up two snapshots.
    // Querying all proposals is fine for scale-to-zero prototype, but let's listen to all proposals and filter in-memory.
    const qProps = query(collection(db, "proposals"));
    const unsubProps = onSnapshot(qProps, (snapshot) => {
      const allProps: any[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const upperDna = myDna.toUpperCase();
        if (data && (data.senderDna === upperDna || data.receiverDna === upperDna)) {
          allProps.push({ id: docSnap.id, ...data });
        }
      });
      allProps.sort((a, b) => b.updatedAt - a.updatedAt);
      setProposals(allProps);
    });

    return () => unsubProps();
  }, [myDna]);

  // 4. Real-time loaded comments for a selected idea
  useEffect(() => {
    if (!selectedIdea) {
      setComments([]);
      return;
    }
    const qComments = query(
      collection(db, "ideas_replies"), 
      where("ideaId", "==", selectedIdea.id)
    );
    const unsubComments = onSnapshot(qComments, (snapshot) => {
      const fetched: any[] = [];
      snapshot.forEach((docSnap) => {
        fetched.push({ id: docSnap.id, ...docSnap.data() });
      });
      // Sort comments oldest first
      fetched.sort((a, b) => a.timestamp - b.timestamp);
      setComments(fetched);
    });

    return () => unsubComments();
  }, [selectedIdea]);

  // Handle Save / Bookmark
  const handleToggleSave = async (e: React.MouseEvent, ideaId: string) => {
    e.stopPropagation();
    if (!myDna) return;
    const docId = `${myDna.toUpperCase()}_${ideaId}`;
    const docRef = doc(db, "saved_ideas", docId);
    
    try {
      if (savedIdeaIds.has(ideaId)) {
        // Unsave
        await deleteDoc(docRef);
        // Decrement count in idea doc
        const ideaRef = doc(db, "ideas", ideaId);
        const ideaSnap = await getDoc(ideaRef);
        if (ideaSnap.exists()) {
          const count = Math.max(0, (ideaSnap.data().savesCount || 0) - 1);
          await updateDoc(ideaRef, { savesCount: count });
        }
      } else {
        // Save
        await setDoc(docRef, {
          id: docId,
          deviceCode: myDna.toUpperCase(),
          ideaId,
          timestamp: Date.now()
        });
        // Increment count in idea doc
        const ideaRef = doc(db, "ideas", ideaId);
        const ideaSnap = await getDoc(ideaRef);
        if (ideaSnap.exists()) {
          const count = (ideaSnap.data().savesCount || 0) + 1;
          await updateDoc(ideaRef, { savesCount: count });
        }
      }
    } catch (err) {
      console.error("Save error:", err);
    }
  };

  // Create Post
  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formSummary.trim() || !formProblem.trim() || !formTargetUsers.trim()) {
      setFormError("Missing required operational parameters. Name, summary, problem, and target demographic must be defined.");
      return;
    }
    setFormError("");
    setFormSuccess(false);

    try {
      const ideaId = "idea_" + Math.random().toString(36).substring(2, 11);
      const newIdea: SeedIdea = {
        id: ideaId,
        title: formName.trim(),
        category: formCategory,
        summary: formSummary.trim(),
        problem: formProblem.trim(),
        targetUsers: formTargetUsers.trim(),
        stage: formStage,
        tested: formTested.trim(),
        feedbackNeeded: formFeedbackNeeded,
        supportNeeded: formSupportNeeded,
        collabMethod: formCollabMethod,
        optionalUrl: formUrl.trim(),
        deviceCode: myDna.toUpperCase(),
        roleLabel: formRoleLabel.trim() || "Idea Submitter",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        status: formStage,
        savesCount: 0,
        reportsCount: 0,
        replyCount: 0,
        proposalCount: 0,
        isRemoved: false,
        isArchived: false,
        type: "COMMUNITY_IDEA",
        commenter: "",
        source: "",
        endorsement: "NONE"
      };

      await setDoc(doc(db, "ideas", ideaId), newIdea);
      setFormSuccess(true);
      
      // Clear fields
      setFormName("");
      setFormSummary("");
      setFormProblem("");
      setFormTargetUsers("");
      setFormTested("");
      setFormUrl("");
      setFormRoleLabel("");
      
      // Redirect to browse
      setTimeout(() => {
        setActiveTab("BROWSE");
        setFormSuccess(false);
      }, 1500);
    } catch (err: any) {
      setFormError(err?.message || "Failed to route idea transmission.");
    }
  };

  // Submit Edit Post
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingIdea) return;
    if (!editTitle.trim() || !editSummary.trim() || !editProblem.trim() || !editTargetUsers.trim()) return;

    try {
      const ideaRef = doc(db, "ideas", editingIdea.id);
      
      // Append historical snapshot to edit history
      const historyItem = {
        timestamp: Date.now(),
        previousTitle: editingIdea.title,
        previousSummary: editingIdea.summary,
        previousProblem: editingIdea.problem,
        previousTargetUsers: editingIdea.targetUsers
      };
      
      const updatedHistory = [...(editingIdea.editHistory || []), historyItem];

      await updateDoc(ideaRef, {
        title: editTitle.trim(),
        summary: editSummary.trim(),
        problem: editProblem.trim(),
        targetUsers: editTargetUsers.trim(),
        editHistory: updatedHistory,
        updatedAt: Date.now()
      });

      // Update selectedIdea view state
      setSelectedIdea({
        ...selectedIdea!,
        title: editTitle.trim(),
        summary: editSummary.trim(),
        problem: editProblem.trim(),
        targetUsers: editTargetUsers.trim(),
        editHistory: updatedHistory,
        updatedAt: Date.now()
      });

      setEditingIdea(null);
    } catch (err) {
      console.error("Edit failed:", err);
    }
  };

  // Submit Thread Comment
  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIdea || !replyText.trim()) return;

    try {
      const replyId = "reply_" + Math.random().toString(36).substring(2, 11);
      const isMyIdea = selectedIdea.deviceCode === myDna.toUpperCase();
      
      const newReply = {
        id: replyId,
        ideaId: selectedIdea.id,
        type: replyType,
        senderDna: myDna.toUpperCase(),
        senderAlias: isMyIdea ? `${myAlias} (CREATOR)` : myAlias,
        text: replyText.trim(),
        timestamp: Date.now(),
        isRemoved: false
      };

      await setDoc(doc(db, "ideas_replies", replyId), newReply);
      
      // Update the parent idea's activity timestamp and reply count
      const parentIdeaRef = doc(db, "ideas", selectedIdea.id);
      const parentIdeaSnap = await getDoc(parentIdeaRef);
      const currentReplyCount = parentIdeaSnap.exists() ? (parentIdeaSnap.data().replyCount || 0) : 0;
      await updateDoc(parentIdeaRef, {
        replyCount: currentReplyCount + 1,
        updatedAt: Date.now()
      });

      setReplyText("");
    } catch (err) {
      console.error("Comment post failed:", err);
    }
  };

  // Moderate/Flag Post
  const handleReportPost = (ideaId: string, title?: string) => {
    setReportTarget({ id: ideaId, type: "IDEA", title });
    setReportReason("SPAM");
    setReportExplanation("");
    setReportResult(null);
    setReportError("");
  };

  // Moderate/Flag Comment
  const handleReportComment = (replyId: string) => {
    setReportTarget({ id: replyId, type: "REPLY" });
    setReportReason("SPAM");
    setReportExplanation("");
    setReportResult(null);
    setReportError("");
  };

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportTarget) return;
    setReportSubmitting(true);
    setReportError("");
    try {
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          targetId: reportTarget.id,
          targetType: reportTarget.type,
          reporterDna: myDna,
          reason: reportReason.trim().toUpperCase() || "OTHER",
          explanation: reportExplanation.trim()
        })
      });

      if (response.ok) {
        const data = await response.json();
        setReportResult({ reference: data.reference || "REC-" + Date.now().toString(36).slice(-4).toUpperCase(), status: data.status || "OPEN" });
      } else {
        const errJson = await response.json().catch(() => null);
        setReportError(errJson?.error || "Failed to submit report. Please try again later.");
      }
    } catch (err) {
      console.error("Report failed:", err);
      setReportError("Error submitting report to moderation queue.");
    } finally {
      setReportSubmitting(false);
    }
  };

  const handleNegotiateTrigger = (e: React.MouseEvent, idea: LiveIdea) => {
    e.stopPropagation();
    if (idea.deviceCode === myDna.toUpperCase()) {
      setSelfNegotiateNotice(true);
      setTimeout(() => setSelfNegotiateNotice(false), 3500);
      return;
    }
    if (onNegotiate) {
      onNegotiate({
        recipientDna: idea.deviceCode,
        ideaId: idea.id,
        ideaTitle: idea.title,
        subject: `NEGOTIATION: ${idea.title.toUpperCase()}`,
        body: `Hello,\n\nI saw your idea "${idea.title}" on the Ideas Hub and would love to negotiate collaboration details. Let's discuss terms and milestones.\n\nBest regards,\nOperator ${myDna.toUpperCase()}`,
        conversationType: "NEGOTIATE"
      });
    }
  };

  // Archive Post
  const handleArchivePost = (ideaId: string) => {
    setConfirmDialog({
      title: "ARCHIVE TRANSMISSION",
      message: "Are you sure you want to archive this idea? It will be marked as ARCHIVED BY CREATOR and close new negotiations.",
      confirmLabel: "CONFIRM ARCHIVE",
      onConfirm: async () => {
        try {
          const ideaRef = doc(db, "ideas", ideaId);
          await updateDoc(ideaRef, {
            isArchived: true,
            status: "ARCHIVED BY CREATOR",
            updatedAt: Date.now()
          });
          if (selectedIdea && selectedIdea.id === ideaId) {
            setSelectedIdea({ ...selectedIdea, isArchived: true, status: "ARCHIVED BY CREATOR" });
          }
        } catch (err) {
          console.error("Archive failed:", err);
        }
      }
    });
  };

  // Submit Negotiation Proposal
  const handleSendProposal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIdea) return;
    if (!proposalContribution.trim() || !proposalRequest.trim() || !proposalRole.trim() || !proposalNextStep.trim()) {
      setProposalError("All core parameters (contribution, request, proposed role, and first milestone step) must be defined.");
      return;
    }
    setProposalError("");
    setProposalSuccess(false);

    try {
      const proposalId = "proposal_" + Math.random().toString(36).substring(2, 11);
      const isCounter = counteringProposal !== null;

      const proposalData = {
        id: proposalId,
        ideaId: selectedIdea.id,
        ideaTitle: selectedIdea.title,
        senderDna: myDna.toUpperCase(),
        receiverDna: isCounter ? counteringProposal.senderDna : selectedIdea.deviceCode,
        contribution: proposalContribution.trim(),
        request: proposalRequest.trim(),
        role: proposalRole.trim(),
        nextStep: proposalNextStep.trim(),
        timeframe: proposalTimeframe.trim(),
        ownership: proposalOwnership.trim(),
        status: "pending",
        parentProposalId: isCounter ? counteringProposal.id : null,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      await setDoc(doc(db, "proposals", proposalId), proposalData);

      // If we are countering, update previous proposal status to "countered"
      if (isCounter) {
        await updateDoc(doc(db, "proposals", counteringProposal.id), {
          status: "countered",
          updatedAt: Date.now()
        });
      }

      // Send inbox notification envelope
      const inboxId = `proposal_notification_${Math.random().toString(36).substring(2, 9)}`;
      const messageBody = isCounter
        ? `COUNTER-PROPOSAL RECEIVED: Operator ${myDna.toUpperCase()} countered your negotiation proposal for "${selectedIdea.title}".\nRole: ${proposalRole.trim()}\nFirst Step: ${proposalNextStep.trim()}`
        : `NEGOTIATION PROPOSAL RECEIVED: Operator ${myDna.toUpperCase()} proposed to collaborate on your idea "${selectedIdea.title}".\nProposed Role: ${proposalRole.trim()}\nFirst Step: ${proposalNextStep.trim()}`;

      await setDoc(doc(db, "inbox", inboxId), {
        id: inboxId,
        toDna: proposalData.receiverDna,
        fromDna: myDna.toUpperCase(),
        fromAlias: myAlias,
        roomCode: "", // No room code required
        message: messageBody,
        isAdminMessage: false,
        timestamp: Date.now(),
        read: false,
        type: isCounter ? "COUNTER_PROPOSAL" : "PROPOSAL",
        ideaId: selectedIdea.id,
        proposalId: proposalId
      });

      // Update parent idea state
      const parentIdeaRef = doc(db, "ideas", selectedIdea.id);
      const parentIdeaSnap = await getDoc(parentIdeaRef);
      const currentProposalCount = parentIdeaSnap.exists() ? (parentIdeaSnap.data().proposalCount || 0) : 0;
      await updateDoc(parentIdeaRef, {
        status: isCounter ? "COUNTER-PROPOSAL RECEIVED" : "ACTIVE NEGOTIATION",
        proposalCount: currentProposalCount + 1,
        updatedAt: Date.now()
      });

      // Write thread log comment
      const systemReplyId = "reply_sys_" + Math.random().toString(36).substring(2, 11);
      await setDoc(doc(db, "ideas_replies", systemReplyId), {
        id: systemReplyId,
        ideaId: selectedIdea.id,
        type: "NEGOTIATE",
        senderDna: "SYSTEM",
        senderAlias: "📡 PHANTOM SYSTEM LOGGER",
        text: isCounter
          ? `[TRANSMISSION LOG] A COUNTER-PROPOSAL was dispatched from Operator **${myDna.toUpperCase()}** to Operator **${proposalData.receiverDna}**.`
          : `[TRANSMISSION LOG] A formal COLLABORATION PROPOSAL was dispatched from Operator **${myDna.toUpperCase()}** to Founder **${proposalData.receiverDna}**.`,
        timestamp: Date.now(),
        isRemoved: false
      });

      setProposalSuccess(true);
      setProposalContribution("");
      setProposalRequest("");
      setProposalRole("");
      setProposalNextStep("");
      setProposalTimeframe("");
      setProposalOwnership("");
      setCounteringProposal(null);

      setTimeout(() => {
        setShowProposalModal(false);
        setProposalSuccess(false);
      }, 1500);
    } catch (err: any) {
      setProposalError(err?.message || "Failed to transmit proposal envelope.");
    }
  };

  // Handle Accept Proposal
  const handleAcceptProposal = (prop: any) => {
    setConfirmDialog({
      title: "ACCEPT PROPOSAL",
      message: "Accept this negotiation proposal? Both participants will see the synchronized relationship and thread progress.",
      confirmLabel: "ACCEPT & SYNCHRONIZE",
      onConfirm: async () => {
        try {
          await updateDoc(doc(db, "proposals", prop.id), {
            status: "accepted",
            updatedAt: Date.now()
          });

          // Send confirmation in thread
          const systemReplyId = "reply_sys_" + Math.random().toString(36).substring(2, 11);
          await setDoc(doc(db, "ideas_replies", systemReplyId), {
            id: systemReplyId,
            ideaId: prop.ideaId,
            type: "NEGOTIATE",
            senderDna: "SYSTEM",
            senderAlias: "📡 PHANTOM SYSTEM LOGGER",
            text: `[SUCCESS LOG] The negotiation proposal submitted by Operator **${prop.senderDna}** has been ACCEPTED by Owner **${prop.receiverDna}**! Operational channels are synchronized.`,
            timestamp: Date.now(),
            isRemoved: false
          });

          // Send Inbox Notification to sender
          const inboxId = `prop_accept_${Math.random().toString(36).substring(2, 9)}`;
          await setDoc(doc(db, "inbox", inboxId), {
            id: inboxId,
            toDna: prop.senderDna,
            fromDna: myDna.toUpperCase(),
            fromAlias: myAlias,
            roomCode: "",
            message: `PROPOSAL ACCEPTED! Founder ${myDna.toUpperCase()} has accepted your collaboration proposal for "${prop.ideaTitle}". Channels are locked!`,
            isAdminMessage: false,
            timestamp: Date.now(),
            read: false,
            type: "SYSTEM",
            ideaId: prop.ideaId,
            proposalId: prop.id
          });

          // Update parent idea status
          await updateDoc(doc(db, "ideas", prop.ideaId), {
            status: "RESOLVED",
            updatedAt: Date.now()
          });

          if (selectedIdea && selectedIdea.id === prop.ideaId) {
            setSelectedIdea({ ...selectedIdea, status: "RESOLVED", updatedAt: Date.now() });
          }
        } catch (err) {
          console.error("Accept proposal failed:", err);
        }
      }
    });
  };

  // Handle Decline Proposal
  const handleDeclineProposal = (prop: any) => {
    setConfirmDialog({
      title: "DECLINE PROPOSAL",
      message: "Decline this collaboration proposal? The idea will return to open community discussion.",
      confirmLabel: "DECLINE PROPOSAL",
      onConfirm: async () => {
        try {
          await updateDoc(doc(db, "proposals", prop.id), {
            status: "declined",
            updatedAt: Date.now()
          });

          // Log decline in thread
          const systemReplyId = "reply_sys_" + Math.random().toString(36).substring(2, 11);
          await setDoc(doc(db, "ideas_replies", systemReplyId), {
            id: systemReplyId,
            ideaId: prop.ideaId,
            type: "NEGOTIATE",
            senderDna: "SYSTEM",
            senderAlias: "📡 PHANTOM SYSTEM LOGGER",
            text: `[SYSTEM NOTICE] The proposal from Operator **${prop.senderDna}** was declined by Owner **${prop.receiverDna}**. Thread returns to open validation.`,
            timestamp: Date.now(),
            isRemoved: false
          });

          // Send Inbox notification
          const inboxId = `prop_decline_${Math.random().toString(36).substring(2, 9)}`;
          await setDoc(doc(db, "inbox", inboxId), {
            id: inboxId,
            toDna: prop.senderDna,
            fromDna: myDna.toUpperCase(),
            fromAlias: myAlias,
            roomCode: "",
            message: `PROPOSAL DECLINED: Founder ${myDna.toUpperCase()} declined your proposal for "${prop.ideaTitle}".`,
            isAdminMessage: false,
            timestamp: Date.now(),
            read: false,
            type: "SYSTEM",
            ideaId: prop.ideaId,
            proposalId: prop.id
          });

          // Restore idea status
          await updateDoc(doc(db, "ideas", prop.ideaId), {
            status: "DISCUSSION OPEN",
            updatedAt: Date.now()
          });

          if (selectedIdea && selectedIdea.id === prop.ideaId) {
            setSelectedIdea({ ...selectedIdea, status: "DISCUSSION OPEN", updatedAt: Date.now() });
          }
        } catch (err) {
          console.error("Decline proposal failed:", err);
        }
      }
    });
  };

  // Trigger Counter-Proposal
  const triggerCounterProposal = (prop: any) => {
    setCounteringProposal(prop);
    setProposalContribution(prop.contribution);
    setProposalRequest(prop.request);
    setProposalRole(prop.role);
    setProposalNextStep(prop.nextStep);
    setProposalTimeframe(prop.timeframe || "");
    setProposalOwnership(prop.ownership || "");
    setShowProposalModal(true);
  };

  // Filter ideas logic
  const filteredIdeas = useMemo(() => {
    return ideas.filter((idea) => {
      // 1. Category check
      if (selectedCategory !== "ALL" && idea.category !== selectedCategory) {
        return false;
      }
      // 2. Status check
      if (selectedStatus !== "ALL" && idea.status !== selectedStatus) {
        return false;
      }
      // 3. Only featured submissions filter
      if (showOnlyFeatured && idea.type !== "IMPORTED_PUBLIC_IDEA") {
        return false;
      }
      // 4. Search check
      if (searchQuery.trim() !== "") {
        const queryClean = searchQuery.toLowerCase();
        const inTitle = idea.title.toLowerCase().includes(queryClean);
        const inSummary = idea.summary.toLowerCase().includes(queryClean);
        const inProblem = idea.problem.toLowerCase().includes(queryClean);
        const inCommenter = idea.commenter && idea.commenter.toLowerCase().includes(queryClean);
        return inTitle || inSummary || inProblem || inCommenter;
      }
      return true;
    });
  }, [ideas, searchQuery, selectedCategory, selectedStatus, showOnlyFeatured]);

  // Transmissions category count helpers
  const myCreatedIdeas = useMemo(() => {
    return ideas.filter(i => i.deviceCode === myDna.toUpperCase());
  }, [ideas, myDna]);

  const mySavedIdeas = useMemo(() => {
    return ideas.filter(i => savedIdeaIds.has(i.id));
  }, [ideas, savedIdeaIds]);

  return (
    <div className="w-full flex-grow flex flex-col h-full bg-transparent text-slate-200 overflow-y-auto p-4 sm:p-6 font-sans">
      
      {/* ================= HEADER SECTION ================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4 mb-6">
        <div className="flex items-center gap-3">
          <button 
            onClick={onBack}
            className="p-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-400 hover:text-white hover:border-slate-700 transition-colors cursor-pointer"
            title="Return to Gate"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-base font-semibold text-white flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-cyan-400" />
              <span>Ideas & Proposals</span>
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Submit ideas, challenge assumptions, and negotiate project collaborations.
            </p>
          </div>
        </div>

        {/* Read-Only Stable Device Fingerprint Display */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-900 border border-slate-800 rounded text-xs font-mono text-slate-400 self-start sm:self-auto">
          <Lock className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
          <span>Device ID:</span>
          <span className="text-cyan-400 font-semibold">{myDna.toUpperCase()}</span>
        </div>
      </div>

      {/* ================= MAIN NAVIGATION TABS ================= */}
      <div className="flex items-center gap-2 border-b border-slate-800/80 pb-3 mb-6 overflow-x-auto">
        <button
          onClick={() => { setActiveTab("BROWSE"); setSelectedIdea(null); }}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer border ${
            activeTab === "BROWSE" && !selectedIdea
              ? "bg-cyan-950/40 border-cyan-500 text-cyan-300 font-semibold"
              : "bg-[#0F121A] border-slate-800 text-slate-400 hover:text-slate-200"
          }`}
        >
          Browse Ideas
        </button>
        <button
          onClick={() => { setActiveTab("POST"); setSelectedIdea(null); }}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer border ${
            activeTab === "POST"
              ? "bg-pink-950/40 border-pink-500 text-pink-300 font-semibold"
              : "bg-[#0F121A] border-slate-800 text-slate-400 hover:text-slate-200"
          }`}
        >
          Post New Idea
        </button>
        <button
          onClick={() => { setActiveTab("MY_TRANSMISSIONS"); setSelectedIdea(null); }}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer border flex items-center gap-1.5 ${
            activeTab === "MY_TRANSMISSIONS" && !selectedIdea
              ? "bg-yellow-950/40 border-yellow-500 text-yellow-300 font-semibold"
              : "bg-[#0F121A] border-slate-800 text-slate-400 hover:text-slate-200"
          }`}
        >
          <span>My Submissions</span>
          {(myCreatedIdeas.length > 0 || proposals.length > 0) && (
            <span className="bg-yellow-500 text-slate-950 text-[10px] font-bold px-1.5 py-0.2 rounded-full">
              {myCreatedIdeas.length + proposals.length}
            </span>
          )}
        </button>
      </div>

      {/* ================= TAB BODY ================= */}
      <div className="flex-grow flex flex-col min-h-0">
        
        {/* VIEW 1: BROWSE BOARD */}
        {activeTab === "BROWSE" && !selectedIdea && (
          <div className="flex-grow flex flex-col lg:grid lg:grid-cols-12 gap-6 min-h-0">
            
            {/* Filter controls column (4 columns on lg) */}
            <div className="lg:col-span-4 xl:col-span-3 space-y-5 flex-shrink-0 bg-black">
              
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-3 w-4 h-4 text-gray-600" />
                <input 
                  type="text" 
                  placeholder="SEARCH KEYWORDS..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[#0d0d0d] border border-gray-800 rounded px-9 py-2.5 text-xs font-mono text-white placeholder-gray-600 uppercase tracking-widest focus:outline-none focus:border-[#0FF]/60 focus:shadow-[0_0_8px_rgba(0,255,255,0.1)] transition-all"
                />
              </div>

              {/* Categories Selector */}
              <div className="border border-gray-900 rounded-lg p-4 bg-black/40">
                <span className="text-[10px] text-[#0FF] font-black block tracking-widest uppercase mb-3 flex items-center gap-1.5">
                  <Filter className="w-3 h-3" />
                  <span>FILTER BY CATEGORY</span>
                </span>
                <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                  <button
                    onClick={() => setSelectedCategory("ALL")}
                    className={`w-full text-left px-2 py-1.5 rounded text-[10px] font-bold uppercase transition-all tracking-wider flex justify-between ${
                      selectedCategory === "ALL" ? "bg-[#0FF]/10 text-[#0FF]" : "text-gray-500 hover:text-white"
                    }`}
                  >
                    <span>ALL CATEGORIES</span>
                    <span>({ideas.length})</span>
                  </button>
                  {dynamicCategories.map((cat) => {
                    const count = ideas.filter(i => i.category === cat).length;
                    return (
                      <button
                        key={cat}
                        onClick={() => setSelectedCategory(cat)}
                        className={`w-full text-left px-2 py-1.5 rounded text-[10px] font-bold uppercase transition-all tracking-wider flex justify-between ${
                          selectedCategory === cat ? "bg-[#0FF]/10 text-[#0FF]" : "text-gray-500 hover:text-white"
                        }`}
                      >
                        <span>{cat}</span>
                        <span>({count})</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Sourcing toggle */}
              <div className="border border-gray-900 rounded-lg p-4 bg-black/45 space-y-3">
                <span className="text-[10px] text-yellow-400 font-black block tracking-widest uppercase flex items-center gap-1.5">
                  <Clock className="w-3 h-3" />
                  <span>SUBMISSION SOURCE</span>
                </span>
                <button
                  onClick={() => setShowOnlyFeatured(!showOnlyFeatured)}
                  className={`w-full py-2 border rounded text-[10px] font-black tracking-widest uppercase transition-all cursor-pointer flex items-center justify-center space-x-1.5 ${
                    showOnlyFeatured
                      ? "bg-yellow-400/10 border-yellow-400 text-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.15)]"
                      : "border-gray-800 text-gray-500 hover:text-white"
                  }`}
                >
                  <span>FEATURED COMMUNITY IDEAS</span>
                  {showOnlyFeatured && <Check className="w-3 h-3" />}
                </button>
                <div className="text-[9px] text-gray-500 uppercase leading-relaxed tracking-wider">
                  Selected public idea and product submissions available for community review.
                </div>
              </div>
            </div>

            {/* Ideas List Column (8 columns on lg) */}
            <div className="lg:col-span-8 xl:col-span-9 flex flex-col min-h-0">
              
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-bold text-gray-400 tracking-widest uppercase flex items-center space-x-2">
                  <span>ACTIVE TRANSMISSIONS ({filteredIdeas.length})</span>
                </h3>
                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">
                  {selectedCategory !== "ALL" ? `Sector: ${selectedCategory}` : "All Sectors"}
                </span>
              </div>

              {isLoading ? (
                <div className="flex-grow flex flex-col items-center justify-center border border-dashed border-gray-900 rounded-lg p-12 bg-black/10">
                  <RefreshCw className="w-8 h-8 text-gray-700 animate-spin mb-3" />
                  <p className="text-xs text-gray-500 uppercase tracking-widest">Accessing ledger records...</p>
                </div>
              ) : filteredIdeas.length === 0 ? (
                <div className="flex-grow flex flex-col items-center justify-center border border-dashed border-gray-900 rounded-lg p-16 text-center bg-black/20">
                  <Lightbulb className="w-8 h-8 text-gray-700 mx-auto mb-3" />
                  <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">No active ideas recorded matching filter criteria.</p>
                  <p className="text-[10px] text-gray-600 mt-1 uppercase">Post a new concept to open community validation and negotiation loops.</p>
                </div>
              ) : (
                <div className="flex-grow overflow-y-auto custom-scrollbar space-y-4 pr-1 min-h-0">
                  {filteredIdeas.map((idea) => {
                    const isMyPost = idea.deviceCode === myDna.toUpperCase();
                    const isSaved = savedIdeaIds.has(idea.id);
                    const isImported = idea.type === "IMPORTED_PUBLIC_IDEA";

                    return (
                      <div 
                        key={idea.id}
                        onClick={() => setSelectedIdea(idea)}
                        className={`border rounded-lg p-5 bg-[#030303]/90 hover:bg-[#070707] transition-all duration-300 relative group cursor-pointer ${
                          isImported 
                            ? "border-yellow-400/20 hover:border-yellow-400/40" 
                            : isMyPost 
                            ? "border-pink-500/25 hover:border-pink-500/40" 
                            : "border-gray-850 hover:border-gray-750"
                        }`}
                      >
                        {/* Header Details */}
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-950 pb-2 mb-3">
                          <div className="flex items-center space-x-2">
                            <span className="bg-[#0FF]/5 border border-[#0FF]/20 px-1.5 py-0.5 rounded text-[8px] font-black text-[#0FF] tracking-widest uppercase">
                              {idea.category}
                            </span>
                            
                            {isImported ? (
                              <span className="bg-yellow-400/5 border border-yellow-400/30 px-1.5 py-0.5 rounded text-[8px] font-black text-yellow-400 tracking-widest uppercase">
                                PUBLIC SOURCE
                              </span>
                            ) : (
                              <span className="bg-[#FF00BD]/5 border border-[#FF00BD]/20 px-1.5 py-0.5 rounded text-[8px] font-black text-[#FF00BD] tracking-widest uppercase">
                                COMMUNITY ORIGINAL
                              </span>
                            )}
                          </div>

                          <div className="text-[9px] text-gray-500 font-bold uppercase tracking-widest flex items-center space-x-2">
                            <span>CREATED: {formatDateDMY(idea.createdAt)}</span>
                            <span>•</span>
                            <span>ACTIVE: {formatDateDMY(idea.updatedAt)}</span>
                          </div>
                        </div>

                        {/* Title & Sourcing labels */}
                        <h4 className="text-sm font-black text-white group-hover:text-[#0FF] transition-colors tracking-widest uppercase">
                          {idea.title}
                        </h4>

                        {/* Short Summary */}
                        <p className="text-xs text-gray-400 mt-2 leading-relaxed font-sans font-medium line-clamp-2">
                          {idea.summary}
                        </p>

                        {/* Expandable SOURCE DETAILS panel */}
                        {isImported && (
                          <div className="mt-3 border-t border-gray-950 pt-2 font-mono">
                            <button
                              onClick={(e) => toggleSourceDetails(e, idea.id)}
                              className="text-[9px] font-black tracking-widest text-yellow-400 uppercase flex items-center space-x-1 hover:underline cursor-pointer bg-transparent border-0 p-0"
                            >
                              <span>[{expandedSourceIds.includes(idea.id) ? "HIDE" : "SHOW"} SOURCE DETAILS]</span>
                              <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${expandedSourceIds.includes(idea.id) ? "rotate-180 animate-pulse" : ""}`} />
                            </button>
                            
                            {expandedSourceIds.includes(idea.id) && (
                              <div className="mt-2 bg-yellow-400/5 border border-yellow-400/10 p-2.5 rounded text-[9px] leading-relaxed text-yellow-200/80 space-y-1">
                                <div><span className="text-gray-500 font-bold uppercase tracking-wider">ORIGIN:</span> {idea.source || "PUBLIC EXTERNAL SUBMISSION"}</div>
                                <div><span className="text-gray-500 font-bold uppercase tracking-wider">ORIGINAL AUTHOR:</span> {idea.commenter}</div>
                                <div><span className="text-gray-500 font-bold uppercase tracking-wider">PHANTOM ENDORSEMENT:</span> {idea.endorsement || "NONE"}</div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Bottom Metadata & Saves */}
                        <div className="flex items-center justify-between mt-4 border-t border-gray-950 pt-3">
                          <div className="flex items-center space-x-4 flex-wrap gap-y-1">
                            <span className="text-[9px] text-gray-500 uppercase tracking-widest">
                              STAGE: <strong className="text-white">{formatStatusLabel(idea.status)}</strong>
                            </span>
                            <span className="text-[9px] text-gray-500 uppercase tracking-widest">
                              REPLIES: <strong className="text-[#0FF]">{idea.replyCount !== undefined ? idea.replyCount : 0}</strong>
                            </span>
                            <span className="text-[9px] text-gray-500 uppercase tracking-widest">
                              PROPOSALS: <strong className="text-[#FF00BD]">{idea.proposalCount !== undefined ? idea.proposalCount : 0}</strong>
                            </span>
                            {idea.editHistory && idea.editHistory.length > 0 && (
                              <span className="bg-gray-900 border border-gray-800 px-1 rounded text-[8px] text-gray-500 font-black uppercase tracking-widest">
                                EDITED ({idea.editHistory.length}x)
                              </span>
                            )}
                          </div>

                          <div className="flex items-center space-x-2">
                            {/* Negotiate action */}
                            {idea.deviceCode !== myDna.toUpperCase() && (
                              <button
                                onClick={(e) => handleNegotiateTrigger(e, idea)}
                                className="p-1.5 rounded border border-gray-800 text-yellow-400 hover:bg-yellow-400/10 hover:border-yellow-400/30 transition-all cursor-pointer text-[9px] font-black uppercase tracking-wider px-2 flex items-center space-x-1"
                                title="Negotiate"
                              >
                                <span>[ NEGOTIATE ]</span>
                              </button>
                            )}

                            {/* Save toggle */}
                            <button
                              onClick={(e) => handleToggleSave(e, idea.id)}
                              className={`p-1.5 rounded border transition-all cursor-pointer flex items-center gap-1.5 text-[9px] font-black tracking-widest ${
                                isSaved
                                  ? "bg-yellow-400/10 border-yellow-400 text-yellow-400"
                                  : "border-gray-800 text-gray-500 hover:text-white hover:border-gray-700"
                              }`}
                            >
                              <Bookmark className={`w-3 h-3 ${isSaved ? "fill-yellow-400 text-yellow-400" : ""}`} />
                              <span>{idea.savesCount || 0}</span>
                            </button>
                            
                            {/* Flag/Report toggle */}
                            <button
                              onClick={(e) => { e.stopPropagation(); handleReportPost(idea.id, idea.title); }}
                              className="p-1.5 rounded border border-gray-800 text-gray-500 hover:text-red-400 hover:border-red-500/20 transition-all cursor-pointer"
                              title="Flag Transmission"
                            >
                              <AlertTriangle className="w-3 h-3" />
                            </button>
                          </div>
                        </div>

                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* VIEW 2: POST A NEW IDEA FORM */}
        {activeTab === "POST" && (
          <div className="flex-grow max-w-3xl mx-auto w-full overflow-y-auto custom-scrollbar pr-1 pb-6 min-h-0">
            <h3 className="text-xs font-bold text-[#FF00BD] tracking-widest uppercase mb-4 flex items-center gap-1.5">
              <Plus className="w-4 h-4 text-[#FF00BD]" />
              <span>DISPATCH NEW TRANSMISSION TO THE LEDGER</span>
            </h3>

            <form onSubmit={handleCreatePost} className="border border-dashed border-gray-800 rounded-lg p-6 bg-black/40 space-y-5">
              
              {/* Field 1: Name */}
              <div>
                <label className="block text-[10px] text-[#FF00BD] font-black uppercase tracking-wider mb-2">
                  1. IDEA OR APP NAME *
                </label>
                <input 
                  type="text"
                  placeholder="E.G. SOLOSAAS PLANNER, ARTISAN PRE-REGISTRY..."
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full bg-[#0d0d0d] border border-gray-800 rounded px-3 py-2 text-xs font-mono text-white placeholder-gray-700 uppercase tracking-widest focus:outline-none focus:border-[#FF00BD]/60 focus:shadow-[0_0_8px_rgba(255,0,189,0.1)] transition-all"
                  maxLength={60}
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Field 2: Category */}
                <div>
                  <label className="block text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-2">
                    2. CATEGORY SELECTOR *
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full bg-[#0d0d0d] border border-gray-800 rounded px-3 py-2 text-xs font-mono text-white uppercase tracking-widest focus:outline-none focus:border-[#FF00BD]/60 transition-all"
                  >
                    {dynamicCategories.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                {/* Field 6: Current Stage */}
                <div>
                  <label className="block text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-2">
                    6. DEVELOPMENT STAGE *
                  </label>
                  <select
                    value={formStage}
                    onChange={(e) => setFormStage(e.target.value)}
                    className="w-full bg-[#0d0d0d] border border-gray-800 rounded px-3 py-2 text-xs font-mono text-white uppercase tracking-widest focus:outline-none focus:border-[#FF00BD]/60 transition-all"
                  >
                    <option value="NEW IDEA">NEW IDEA</option>
                    <option value="NEEDS VALIDATION">NEEDS VALIDATION</option>
                    <option value="DISCUSSION OPEN">DISCUSSION OPEN</option>
                    <option value="SEEKING COLLABORATOR">SEEKING COLLABORATOR</option>
                    <option value="ACTIVE NEGOTIATION">ACTIVE NEGOTIATION</option>
                  </select>
                </div>
              </div>

              {/* Field 3: Short Summary */}
              <div>
                <label className="block text-[10px] text-[#FF00BD] font-black uppercase tracking-wider mb-2">
                  3. ELEVATOR PITCH / SHORT SUMMARY * (Max 180 chars)
                </label>
                <textarea
                  placeholder="WHAT IS THE CORE PRODUCT CONCEPT IN TWO SENTENCES?"
                  value={formSummary}
                  onChange={(e) => setFormSummary(e.target.value)}
                  className="w-full h-16 bg-[#0d0d0d] border border-gray-800 rounded px-3 py-2 text-xs font-mono text-white placeholder-gray-700 uppercase tracking-widest focus:outline-none focus:border-[#FF00BD]/60 transition-all resize-none"
                  maxLength={180}
                  required
                />
              </div>

              {/* Field 4: What Problem Solved */}
              <div>
                <label className="block text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-2">
                  4. WHAT PROBLEM DOES THIS SOLVE? *
                </label>
                <textarea
                  placeholder="DESCRIBE THE CORE FRICTION OR BURNING PAIN POINT EXPERIENCED BY CUSTOMERS..."
                  value={formProblem}
                  onChange={(e) => setFormProblem(e.target.value)}
                  className="w-full h-20 bg-[#0d0d0d] border border-gray-800 rounded px-3 py-2 text-xs font-mono text-white placeholder-gray-700 uppercase tracking-widest focus:outline-none focus:border-[#FF00BD]/60 transition-all"
                  required
                />
              </div>

              {/* Field 5: Target Users */}
              <div>
                <label className="block text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-2">
                  5. WHO ARE THE TARGET USERS / CUSTOMERS? *
                </label>
                <textarea
                  placeholder="BE SPECIFIC: E.G., COFFEE SHOP BAKERS, REMOTE REACT DEVS, SUBURBAN CAR OWNERS..."
                  value={formTargetUsers}
                  onChange={(e) => setFormTargetUsers(e.target.value)}
                  className="w-full h-20 bg-[#0d0d0d] border border-gray-800 rounded px-3 py-2 text-xs font-mono text-white placeholder-gray-700 uppercase tracking-widest focus:outline-none focus:border-[#FF00BD]/60 transition-all"
                  required
                />
              </div>

              {/* Field 7: Tested Already */}
              <div>
                <label className="block text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-2">
                  7. WHAT HAS BEEN TESTED ALREADY? (SMOKE TESTS, INTERVIEWS, PROTOTYPES...)
                </label>
                <textarea
                  placeholder="DESCRIBE PREVIOUS USER INTERVIEWS, LANDING PAGES, SPREADSHEET SIMULATIONS..."
                  value={formTested}
                  onChange={(e) => setFormTested(e.target.value)}
                  className="w-full h-20 bg-[#0d0d0d] border border-gray-800 rounded px-3 py-2 text-xs font-mono text-white placeholder-gray-700 uppercase tracking-widest focus:outline-none focus:border-[#FF00BD]/60 transition-all"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Field 8: Feedback Needed */}
                <div>
                  <label className="block text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-2">
                    8. WHAT FEEDBACK IS NEEDED?
                  </label>
                  <select
                    value={formFeedbackNeeded}
                    onChange={(e) => setFormFeedbackNeeded(e.target.value)}
                    className="w-full bg-[#0d0d0d] border border-gray-800 rounded px-3 py-2 text-xs font-mono text-white uppercase tracking-widest focus:outline-none focus:border-[#FF00BD]/60 transition-all"
                  >
                    {FEEDBACK_TYPES.map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>

                {/* Field 9: Support Needed */}
                <div>
                  <label className="block text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-2">
                    9. WHAT SUPPORT IS NEEDED?
                  </label>
                  <select
                    value={formSupportNeeded}
                    onChange={(e) => setFormSupportNeeded(e.target.value)}
                    className="w-full bg-[#0d0d0d] border border-gray-800 rounded px-3 py-2 text-xs font-mono text-white uppercase tracking-widest focus:outline-none focus:border-[#FF00BD]/60 transition-all"
                  >
                    {SUPPORT_TYPES.map((st) => (
                      <option key={st} value={st}>{st}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Field 10: Collaboration Method */}
                <div>
                  <label className="block text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-2">
                    10. COLLABORATION METHOD
                  </label>
                  <select
                    value={formCollabMethod}
                    onChange={(e) => setFormCollabMethod(e.target.value)}
                    className="w-full bg-[#0d0d0d] border border-gray-800 rounded px-3 py-2 text-xs font-mono text-white uppercase tracking-widest focus:outline-none focus:border-[#FF00BD]/60 transition-all"
                  >
                    {COLLAB_METHODS.map((method) => (
                      <option key={method} value={method}>{method}</option>
                    ))}
                  </select>
                </div>

                {/* Field 13: Optional Role Label */}
                <div>
                  <label className="block text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-2">
                    13. YOUR PROJECT ROLE LABEL
                  </label>
                  <input 
                    type="text"
                    placeholder="E.G. PRODUCT LEAD, BACKEND DEV, DESIGNER..."
                    value={formRoleLabel}
                    onChange={(e) => setFormRoleLabel(e.target.value)}
                    className="w-full bg-[#0d0d0d] border border-gray-800 rounded px-3 py-2 text-xs font-mono text-white placeholder-gray-700 uppercase tracking-widest focus:outline-none focus:border-[#FF00BD]/60 transition-all"
                    maxLength={30}
                  />
                </div>
              </div>

              {/* Field 11: Optional URL */}
              <div>
                <label className="block text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-2">
                  11. OPTIONAL URL OR APP-STORE LINK
                </label>
                <input 
                  type="url"
                  placeholder="HTTPS://MYDEMOLINK.COM"
                  value={formUrl}
                  onChange={(e) => setFormUrl(e.target.value)}
                  className="w-full bg-[#0d0d0d] border border-gray-800 rounded px-3 py-2 text-xs font-mono text-white placeholder-gray-700 uppercase tracking-widest focus:outline-none focus:border-[#FF00BD]/60 transition-all"
                />
              </div>

              {/* Field 12: Read-Only Device Code */}
              <div>
                <label className="block text-[10px] text-gray-600 uppercase tracking-wider mb-2 font-black">
                  12. FINGERPRINT SENDER DEVICE CODE (READ-ONLY ID Anchor)
                </label>
                <input 
                  type="text"
                  value={myDna.toUpperCase()}
                  className="w-full bg-gray-950/60 border border-gray-900 rounded px-3 py-2 text-xs font-mono text-gray-600 uppercase cursor-not-allowed tracking-widest"
                  readOnly
                />
                <span className="text-[8px] text-gray-600 uppercase tracking-widest mt-1 block">
                  // This device code binds your post securely. It cannot be altered or spoofed. //
                </span>
              </div>

              {/* Status Alert logs */}
              {formError && (
                <div className="p-3 bg-red-950/20 border border-red-500/20 rounded text-xs text-red-400 font-bold leading-relaxed">
                  [ERROR] {formError}
                </div>
              )}

              {formSuccess && (
                <div className="p-3 bg-emerald-950/20 border border-emerald-500/20 rounded text-xs text-emerald-400 font-bold leading-relaxed">
                  ✓ [TRANSMISSION ACQUIRED] Idea posted securely. Synching board...
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={formSuccess}
                className={`w-full py-3 rounded font-black tracking-widest uppercase transition-all duration-200 border text-xs cursor-pointer flex items-center justify-center space-x-2 ${
                  formSuccess
                    ? "bg-gray-950/40 border-gray-900 text-gray-600 cursor-not-allowed"
                    : "bg-[#FF00BD] hover:bg-[#FF00BD]/80 text-black border-[#FF00BD] shadow-glow-pink"
                }`}
              >
                <Send className="w-4 h-4" />
                <span>DISPATCH TRANSMISSION</span>
              </button>

            </form>
          </div>
        )}

        {/* VIEW 3: MY TRANSMISSIONS (My Created, Saved, and Active Proposals) */}
        {activeTab === "MY_TRANSMISSIONS" && !selectedIdea && (
          <div className="flex-grow flex flex-col space-y-6 overflow-y-auto custom-scrollbar pr-1 pb-6 min-h-0">
            
            {/* Grid layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Box A: My Created Ideas */}
              <div className="border border-gray-900 rounded-lg p-5 bg-black/30 space-y-4">
                <h4 className="text-xs font-black text-white tracking-widest uppercase flex items-center justify-between">
                  <span>A. MY DISPATCHED IDEAS ({myCreatedIdeas.length})</span>
                  <Lightbulb className="w-4 h-4 text-[#0FF]" />
                </h4>
                
                {myCreatedIdeas.length === 0 ? (
                  <div className="border border-dashed border-gray-950 rounded p-6 text-center text-[10px] text-gray-600 uppercase tracking-wider">
                    You have not routed any original ideas yet.
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-80 overflow-y-auto custom-scrollbar pr-1">
                    {myCreatedIdeas.map((idea) => (
                      <div 
                        key={idea.id}
                        onClick={() => setSelectedIdea(idea)}
                        className="p-3 border border-gray-850 rounded hover:border-[#0FF]/30 cursor-pointer transition-all bg-[#080808]"
                      >
                        <span className="text-[8px] text-[#0FF] uppercase font-black block tracking-widest mb-1">{idea.category}</span>
                        <h5 className="text-xs font-bold text-white tracking-wider uppercase truncate">{idea.title}</h5>
                        <p className="text-[10px] text-gray-500 mt-1 line-clamp-1">{idea.summary}</p>
                        <div className="flex items-center justify-between text-[8px] text-gray-600 mt-2">
                          <span>STAGE: {formatStatusLabel(idea.status)}</span>
                          <span>UPDATED: {formatDateDMY(idea.updatedAt)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Box B: My Saved Ideas */}
              <div className="border border-gray-900 rounded-lg p-5 bg-black/30 space-y-4">
                <h4 className="text-xs font-black text-white tracking-widest uppercase flex items-center justify-between">
                  <span>B. SAVED / BOOKMARKED IDEAS ({mySavedIdeas.length})</span>
                  <Bookmark className="w-4 h-4 text-yellow-400" />
                </h4>
                
                {mySavedIdeas.length === 0 ? (
                  <div className="border border-dashed border-gray-950 rounded p-6 text-center text-[10px] text-gray-600 uppercase tracking-wider">
                    No ideas bookmarked. Browse the board to save interesting concepts.
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-80 overflow-y-auto custom-scrollbar pr-1">
                    {mySavedIdeas.map((idea) => (
                      <div 
                        key={idea.id}
                        onClick={() => setSelectedIdea(idea)}
                        className="p-3 border border-gray-850 rounded hover:border-yellow-400/30 cursor-pointer transition-all bg-[#080808]"
                      >
                        <span className="text-[8px] text-yellow-400 uppercase font-black block tracking-widest mb-1">{idea.category}</span>
                        <h5 className="text-xs font-bold text-white tracking-wider uppercase truncate">{idea.title}</h5>
                        <p className="text-[10px] text-gray-500 mt-1 line-clamp-1">{idea.summary}</p>
                        <div className="flex items-center justify-between text-[8px] text-gray-600 mt-2">
                          <span>STAGE: {formatStatusLabel(idea.status)}</span>
                          <span>SAVED BY: {idea.commenter || `DNA ${idea.deviceCode}`}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>

            {/* Box C: Active Proposals (Incoming / Outgoing Proposals) */}
            <div className="border border-gray-900 rounded-lg p-5 bg-black/35 space-y-4">
              <h4 className="text-xs font-black text-white tracking-widest uppercase flex items-center justify-between">
                <span>C. FORMAL NEGOTIATION PROPOSALS ({proposals.length})</span>
                <Users className="w-4 h-4 text-pink-500" />
              </h4>

              {proposals.length === 0 ? (
                <div className="border border-dashed border-gray-950 rounded p-8 text-center text-[10px] text-gray-600 uppercase tracking-wider">
                  No pending proposals or active negotiation logs registered to this device code.
                </div>
              ) : (
                <div className="space-y-4">
                  {proposals.map((prop) => {
                    const isOutgoing = prop.senderDna === myDna.toUpperCase();
                    const relatedIdea = ideas.find(i => i.id === prop.ideaId);

                    return (
                      <div 
                        key={prop.id}
                        className={`border rounded-lg p-4 bg-black/60 transition-all ${
                          prop.status === "accepted" 
                            ? "border-emerald-500/30 bg-emerald-950/5" 
                            : prop.status === "declined" 
                            ? "border-red-500/20 bg-red-950/5" 
                            : "border-gray-800"
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-gray-900/60 pb-2 mb-3 gap-2">
                          <div className="flex items-center space-x-2">
                            {isOutgoing ? (
                              <span className="bg-pink-500/10 border border-pink-500/30 text-pink-500 text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-widest">
                                OUTGOING PROPOSAL
                              </span>
                            ) : (
                              <span className="bg-[#0FF]/15 border border-[#0FF]/30 text-[#0FF] text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-widest">
                                INCOMING PROPOSAL
                              </span>
                            )}
                            <h5 className="text-xs font-bold text-white tracking-widest uppercase truncate max-w-[200px]">
                              {prop.ideaTitle}
                            </h5>
                          </div>

                          <div className="text-[9px] font-black tracking-widest uppercase flex items-center space-x-2">
                            <span>STATUS: 
                              <strong className={`ml-1 ${
                                prop.status === "accepted" ? "text-emerald-400 animate-pulse" :
                                prop.status === "declined" ? "text-red-400" :
                                "text-yellow-400"
                              }`}>
                                {(prop.status || "").toUpperCase()}
                              </strong>
                            </span>
                          </div>
                        </div>

                        {/* Proposal Details Box */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[10px] leading-relaxed text-gray-400 mt-2 bg-[#090909] p-3 rounded border border-gray-950">
                          <div>
                            <strong className="text-gray-500 uppercase block tracking-wider mb-1">Proposed Role:</strong>
                            <p className="text-white font-sans font-medium uppercase text-xs">{prop.role}</p>
                          </div>
                          <div>
                            <strong className="text-gray-500 uppercase block tracking-wider mb-1">Timeframe:</strong>
                            <p className="text-white font-sans font-medium">{prop.timeframe || "Not Specified"}</p>
                          </div>
                          <div className="md:col-span-2 border-t border-gray-900/40 pt-2">
                            <strong className="text-gray-500 uppercase block tracking-wider mb-0.5">Offered Contributions:</strong>
                            <p className="text-gray-300 font-sans whitespace-pre-wrap">{prop.contribution}</p>
                          </div>
                          <div className="md:col-span-2 border-t border-t-gray-900/40 pt-2">
                            <strong className="text-gray-500 uppercase block tracking-wider mb-0.5">Requested Scope / Equity:</strong>
                            <p className="text-gray-300 font-sans whitespace-pre-wrap">{prop.request}</p>
                          </div>
                          <div className="md:col-span-2 border-t border-t-gray-900/40 pt-2">
                            <strong className="text-gray-500 uppercase block tracking-wider mb-0.5">First Immediate Milestone:</strong>
                            <p className="text-gray-300 font-sans whitespace-pre-wrap text-yellow-300/80">{prop.nextStep}</p>
                          </div>
                          {prop.ownership && (
                            <div className="md:col-span-2 border-t border-t-gray-900/40 pt-2">
                              <strong className="text-gray-500 uppercase block tracking-wider mb-0.5">Ownership Structure Notes:</strong>
                              <p className="text-gray-300 font-sans whitespace-pre-wrap">{prop.ownership}</p>
                            </div>
                          )}
                        </div>

                        {/* Incoming interactive actions */}
                        {!isOutgoing && prop.status === "pending" && (
                          <div className="flex items-center space-x-2 mt-4 justify-end">
                            <button
                              onClick={() => handleAcceptProposal(prop)}
                              className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-black font-black text-[9px] tracking-widest rounded transition-all cursor-pointer uppercase flex items-center space-x-1"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>ACCEPT PROPOSAL</span>
                            </button>
                            <button
                              onClick={() => handleDeclineProposal(prop)}
                              className="px-3 py-1.5 bg-transparent hover:bg-red-500/10 border border-red-500/20 text-red-400 font-black text-[9px] tracking-widest rounded transition-all cursor-pointer uppercase"
                            >
                              DECLINE
                            </button>
                            <button
                              onClick={() => {
                                if (relatedIdea) {
                                  setSelectedIdea(relatedIdea);
                                  triggerCounterProposal(prop);
                                }
                              }}
                              className="px-3 py-1.5 bg-[#0FF]/10 border border-[#0FF]/30 text-[#0FF] hover:bg-[#0FF] hover:text-black font-black text-[9px] tracking-widest rounded transition-all cursor-pointer uppercase"
                            >
                              COUNTER
                            </button>
                          </div>
                        )}

                        {/* Incoming/Outgoing accepted notification status */}
                        {prop.status === "accepted" && (
                          <div className="mt-3 flex items-center justify-between p-2.5 rounded bg-emerald-950/20 border border-emerald-500/10 text-[9px] text-emerald-400 font-black tracking-widest">
                            <div className="flex items-center space-x-2">
                              <CheckCircle className="w-4 h-4 text-emerald-400" />
                              <span>PROPOSAL LOCKED IN. CHANNELS SECURED.</span>
                            </div>
                            <span className="text-[8px] text-gray-500">REF: {(prop.id || "").toUpperCase()}</span>
                          </div>
                        )}

                      </div>
                    );
                  })}
                </div>
              )}

            </div>
          </div>
        )}

        {/* VIEW 4: SELECTED IDEA DISCUSSION & THREAD DETAILED PAGE */}
        {selectedIdea && (
          <div className="flex-grow flex flex-col lg:grid lg:grid-cols-12 gap-6 min-h-0 overflow-y-auto lg:overflow-y-hidden">
            
            {/* Left side details card (5 columns on lg) */}
            <div className="lg:col-span-5 flex flex-col space-y-4 overflow-y-auto custom-scrollbar pb-6 lg:pb-0 pr-1 flex-shrink-0">
              <button
                onClick={() => setSelectedIdea(null)}
                className="w-fit px-3 py-1.5 bg-[#090909] hover:bg-gray-900 border border-gray-800 rounded text-[10px] font-black tracking-widest uppercase flex items-center space-x-1 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>BACK TO DIRECTORY</span>
              </button>

              {/* Central Details Information Sheet */}
              <div className={`border rounded-lg p-5 bg-[#030303]/90 relative ${
                selectedIdea.type === "IMPORTED_PUBLIC_IDEA" ? "border-yellow-400/25" : "border-gray-850"
              }`}>
                
                {/* Badges row */}
                <div className="flex items-center justify-between border-b border-gray-950 pb-2 mb-3">
                  <div className="flex items-center space-x-2">
                    <span className="bg-[#0FF]/5 border border-[#0FF]/25 px-1.5 py-0.5 rounded text-[8px] font-black text-[#0FF] tracking-widest uppercase">
                      {selectedIdea.category}
                    </span>
                    <span className="bg-transparent border border-gray-900 px-1.5 py-0.5 rounded text-[8px] font-black text-[#0FF] tracking-widest uppercase">
                      REPLIES: {selectedIdea.replyCount !== undefined ? selectedIdea.replyCount : 0}
                    </span>
                    <span className="bg-transparent border border-gray-900 px-1.5 py-0.5 rounded text-[8px] font-black text-[#FF00BD] tracking-widest uppercase">
                      PROPOSALS: {selectedIdea.proposalCount !== undefined ? selectedIdea.proposalCount : 0}
                    </span>
                  </div>
                  <span className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">
                    Milestone: {formatStatusLabel(selectedIdea.status)}
                  </span>
                </div>

                <h2 className="text-base font-black text-white tracking-widest uppercase mb-4">
                  {selectedIdea.title}
                </h2>

                {/* Core questions block */}
                <div className="space-y-4 font-sans text-xs">
                  
                  {/* Summary */}
                  <div className="bg-[#090909] p-3 rounded border border-gray-950 font-mono">
                    <strong className="text-[10px] text-[#0FF] block tracking-widest uppercase mb-1">// ELEVATOR PITCH</strong>
                    <p className="text-gray-300 font-medium leading-relaxed">{selectedIdea.summary}</p>
                  </div>

                  {/* Problem */}
                  <div>
                    <strong className="text-[9px] text-gray-500 block uppercase tracking-widest font-mono mb-1">// THE PROBLEM IT SOLVES</strong>
                    <p className="text-gray-400 leading-relaxed font-medium">{selectedIdea.problem}</p>
                  </div>

                  {/* Target Users */}
                  <div>
                    <strong className="text-[9px] text-gray-500 block uppercase tracking-widest font-mono mb-1">// TARGET USERS</strong>
                    <p className="text-gray-400 leading-relaxed font-medium">{selectedIdea.targetUsers}</p>
                  </div>

                  {/* Stage and tested */}
                  {selectedIdea.tested && (
                    <div>
                      <strong className="text-[9px] text-gray-500 block uppercase tracking-widest font-mono mb-1">// EXPERIMENTAL EVIDENCE / VALIDATION</strong>
                      <p className="text-gray-400 leading-relaxed font-medium">{selectedIdea.tested}</p>
                    </div>
                  )}

                  {/* Optional App URL */}
                  {selectedIdea.optionalUrl && (
                    <div>
                      <strong className="text-[9px] text-gray-500 block uppercase tracking-widest font-mono mb-1">// DEPLOYED LINK / PROTOTYPE</strong>
                      <a 
                        href={selectedIdea.optionalUrl} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="text-[#0FF] hover:underline flex items-center space-x-1 mt-0.5 text-[10.5px] font-mono font-bold"
                      >
                        <span>{selectedIdea.optionalUrl}</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  )}

                  {/* Source Stamp for Imported Submissions */}
                  {selectedIdea.type === "IMPORTED_PUBLIC_IDEA" && (
                    <div className="space-y-4">
                      {/* ORIGINAL PUBLIC SUBMISSION notice & original text */}
                      <div className="bg-yellow-400/5 border border-yellow-400/10 p-3.5 rounded font-mono space-y-2">
                        <div className="text-[10px] font-black text-yellow-400 uppercase tracking-widest flex items-center gap-1.5 border-b border-yellow-400/10 pb-1.5">
                          <FileText className="w-3.5 h-3.5 text-yellow-400" />
                          <span>ORIGINAL PUBLIC SUBMISSION</span>
                        </div>
                        <p className="text-[11px] leading-relaxed text-yellow-200/80 font-sans italic whitespace-pre-wrap">
                          "{selectedIdea.originalSubmission || selectedIdea.problem}"
                        </p>
                      </div>

                      {/* PHANTOM DISCUSSION STARTER notice & text */}
                      <div className="bg-[#090909] border border-gray-950 p-3.5 rounded font-mono space-y-2">
                        <div className="text-[9.5px] font-black text-[#0FF] uppercase tracking-widest flex items-center gap-1.5 border-b border-gray-900 pb-1.5">
                          <MessageSquare className="w-3.5 h-3.5 text-[#0FF]" />
                          <span>PHANTOM DISCUSSION STARTER</span>
                        </div>
                        <p className="text-[9.5px] leading-relaxed text-gray-500 uppercase tracking-wider">
                          This idea was originally proposed in a public feedback channel. To help bootstrap discussion, our operators drafted a phantom discussion starter below.
                        </p>
                        <p className="text-[11px] leading-relaxed text-gray-300 font-sans font-medium bg-black/40 p-2.5 rounded border border-gray-900/60">
                          {selectedIdea.discussionStarter}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Submitter DNA block */}
                  <div className="border-t border-gray-950 pt-3 flex flex-wrap items-center justify-between text-[9px] text-gray-500 font-mono gap-2">
                    <div>
                      <span>AUTHOR FINGERPRINT: </span>
                      <strong className="text-white font-bold">{selectedIdea.deviceCode}</strong>
                      {selectedIdea.roleLabel && <span className="text-gray-600 block text-[8px] mt-0.5 uppercase">// ROLE: {selectedIdea.roleLabel} //</span>}
                    </div>
                    <span>CREATED: {formatDateDMY(selectedIdea.createdAt)}</span>
                  </div>

                </div>

                {/* Edit & Archive Actions (For Submitter Only) */}
                {selectedIdea.deviceCode === myDna.toUpperCase() && !selectedIdea.isArchived && (
                  <div className="flex items-center space-x-2 mt-4 pt-3 border-t border-gray-950 justify-end">
                    <button
                      onClick={() => {
                        setEditingIdea(selectedIdea);
                        setEditTitle(selectedIdea.title);
                        setEditSummary(selectedIdea.summary);
                        setEditProblem(selectedIdea.problem);
                        setEditTargetUsers(selectedIdea.targetUsers);
                      }}
                      className="px-2.5 py-1.5 bg-[#090909] hover:bg-gray-900 border border-gray-800 text-white rounded text-[9px] font-black tracking-widest uppercase flex items-center space-x-1 cursor-pointer"
                    >
                      <Edit3 className="w-3 h-3 text-[#0FF]" />
                      <span>EDIT POST</span>
                    </button>
                    <button
                      onClick={() => handleArchivePost(selectedIdea.id)}
                      className="px-2.5 py-1.5 bg-transparent hover:bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 rounded text-[9px] font-black tracking-widest uppercase flex items-center space-x-1 cursor-pointer"
                    >
                      <Clock className="w-3 h-3" />
                      <span>ARCHIVE POST</span>
                    </button>
                  </div>
                )}

                {/* Negotiate Action (For Other Operators Only) */}
                {selectedIdea.deviceCode !== myDna.toUpperCase() && (
                  <div className="space-y-2 mt-4 pt-3 border-t border-gray-950">
                    <button
                      onClick={(e) => handleNegotiateTrigger(e, selectedIdea)}
                      className="w-full py-2.5 bg-yellow-400 hover:bg-yellow-300 text-black border border-yellow-400 rounded text-xs font-black tracking-widest uppercase flex items-center justify-center space-x-2 cursor-pointer shadow-[0_0_15px_rgba(250,204,21,0.1)]"
                    >
                      <MessageSquare className="w-4 h-4 text-black" />
                      <span>NEGOTIATE TERMS &amp; COLLABORATION</span>
                    </button>
                    <div className="flex items-center justify-between pt-1">
                      <button
                        onClick={() => handleReportPost(selectedIdea.id, selectedIdea.title)}
                        className="text-[9px] text-gray-600 hover:text-red-400 flex items-center space-x-1 uppercase tracking-wider font-mono transition-colors"
                        title="Report this idea for moderation review"
                      >
                        <AlertTriangle className="w-3 h-3" />
                        <span>FLAG TRANSMISSION FOR REVIEW</span>
                      </button>
                      <span className="text-[8px] text-gray-700 tracking-wider uppercase font-mono">SECURE ANONYMITY</span>
                    </div>
                  </div>
                )}

              </div>
            </div>

            {/* Right side discussion thread (7 columns on lg) */}
            <div className="lg:col-span-7 flex flex-col h-full min-h-0 bg-[#020202] border border-gray-900 rounded-lg p-4 relative">
              
              <div className="flex items-center justify-between border-b border-gray-950 pb-2.5 mb-3 flex-shrink-0">
                <h3 className="text-xs font-black text-[#0FF] tracking-widest uppercase flex items-center space-x-1.5">
                  <MessageSquare className="w-4 h-4 text-[#0FF]" />
                  <span>THREADED DISCUSSION &amp; VENTURE AUDIT</span>
                </h3>
                <span className="text-[9px] text-gray-500 uppercase font-black tracking-widest">
                  {comments.length} CHANNELS SYNCD
                </span>
              </div>

              {/* Thread List Scroll area */}
              <div className="flex-grow overflow-y-auto custom-scrollbar space-y-4 pr-1 mb-4 min-h-0">
                {comments.length === 0 ? (
                  <div className="flex-grow flex flex-col items-center justify-center p-10 text-center border border-dashed border-gray-950 rounded h-full bg-black/10">
                    <MessageSquare className="w-6 h-6 text-gray-800 mb-2" />
                    {selectedIdea.type === "IMPORTED_PUBLIC_IDEA" ? (
                      <>
                        <p className="text-[10px] text-yellow-400 font-black tracking-widest uppercase mb-1">
                          NO COMMUNITY REPLIES YET
                        </p>
                        <p className="text-[9px] text-gray-500 uppercase leading-normal max-w-xs">
                          BE THE FIRST OPERATOR TO INITIATE A FORMAL CHALLENGE OR OPEN NEGOTIATIONS.
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-[10px] text-gray-600 uppercase tracking-widest">Discussion ledger empty.</p>
                        <p className="text-[9px] text-gray-700 uppercase mt-1">Submit a query or click Challenge to validate assumptions.</p>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {comments.map((c) => {
                      const isSys = c.senderDna === "SYSTEM";
                      const isMyReply = c.senderDna === myDna.toUpperCase();
                      const isCreator = c.senderDna === selectedIdea.deviceCode;

                      return (
                        <div 
                          key={c.id}
                          className={`p-3.5 rounded border text-xs leading-relaxed relative ${
                            isSys
                              ? "bg-[#FF00BD]/5 border-[#FF00BD]/15 text-pink-300"
                              : c.type === "CHALLENGE"
                              ? "bg-red-500/5 border-red-500/15"
                              : c.type === "COLLABORATE"
                              ? "bg-[#0FF]/5 border-[#0FF]/15"
                              : c.type === "NEGOTIATE"
                              ? "bg-yellow-400/5 border-yellow-400/15"
                              : "bg-[#090909] border-gray-900"
                          }`}
                        >
                          <div className="flex items-center justify-between border-b border-gray-950 pb-1.5 mb-2 gap-2 text-[9px]">
                            <div className="flex items-center space-x-2">
                              {/* Reply type indicator */}
                              <span className={`px-1.5 py-0.2 rounded font-black uppercase tracking-wider text-[7.5px] ${
                                c.type === "CHALLENGE" ? "bg-red-500/10 text-red-400" :
                                c.type === "COLLABORATE" ? "bg-[#0FF]/15 text-[#0FF]" :
                                c.type === "NEGOTIATE" ? "bg-yellow-400/15 text-yellow-400" :
                                "bg-gray-850 text-gray-500"
                              }`}>
                                {c.type}
                              </span>

                              <span className="font-bold text-gray-400 truncate max-w-[120px]">
                                {c.senderAlias || `Operator ${c.senderDna}`}
                              </span>
                              
                              {/* PHANTOM COMMUNITY REPLY labels */}
                              {selectedIdea.type === "IMPORTED_PUBLIC_IDEA" && !isCreator && !isSys && (
                                <span className="bg-[#0FF]/5 border border-[#0FF]/25 px-1 py-0.1 text-[7px] font-black text-[#0FF] tracking-widest rounded-sm">
                                  PHANTOM COMMUNITY REPLY
                                </span>
                              )}
                            </div>

                            <div className="flex items-center space-x-2">
                              <span className="text-gray-600 font-bold tracking-widest">
                                {new Date(c.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              
                              {/* Flag Comment */}
                              {!isSys && !isMyReply && (
                                <button
                                  onClick={() => handleReportComment(c.id)}
                                  className="text-gray-600 hover:text-red-500 transition-colors p-0.5"
                                  title="Flag comment"
                                >
                                  <AlertTriangle className="w-2.5 h-2.5" />
                                </button>
                              )}
                            </div>
                          </div>

                          <p className={`font-sans font-medium break-words ${c.isRemoved ? "text-gray-600 italic" : "text-gray-300"}`}>
                            {c.text}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Bottom text reply entry block */}
              <div className="flex-shrink-0 mt-auto bg-black border-t border-gray-950 pt-3">
                
                {/* Labels selecting row */}
                <div className="flex items-center space-x-1.5 mb-2.5 overflow-x-auto pb-1">
                  <span className="text-[8.5px] text-gray-500 uppercase tracking-widest mr-1.5 font-bold">REPLY INTENT:</span>
                  <button
                    onClick={() => setReplyType("DISCUSS")}
                    className={`px-2 py-1 rounded text-[8.5px] font-black tracking-widest uppercase transition-all border ${
                      replyType === "DISCUSS"
                        ? "bg-gray-800 border-gray-600 text-white"
                        : "bg-[#050505] border-gray-950 text-gray-500 hover:text-gray-300"
                    }`}
                  >
                    DISCUSS
                  </button>
                  <button
                    onClick={() => setReplyType("CHALLENGE")}
                    className={`px-2 py-1 rounded text-[8.5px] font-black tracking-widest uppercase transition-all border ${
                      replyType === "CHALLENGE"
                        ? "bg-red-500/10 border-red-500 text-red-400"
                        : "bg-[#050505] border-gray-950 text-gray-500 hover:text-red-400"
                    }`}
                  >
                    CHALLENGE
                  </button>
                  <button
                    onClick={() => setReplyType("COLLABORATE")}
                    className={`px-2 py-1 rounded text-[8.5px] font-black tracking-widest uppercase transition-all border ${
                      replyType === "COLLABORATE"
                        ? "bg-[#0FF]/15 border-[#0FF] text-[#0FF]"
                        : "bg-[#050505] border-gray-950 text-gray-500 hover:text-[#0FF]"
                    }`}
                  >
                    COLLABORATE
                  </button>
                  <button
                    onClick={() => setReplyType("NEGOTIATE")}
                    className={`px-2 py-1 rounded text-[8.5px] font-black tracking-widest uppercase transition-all border ${
                      replyType === "NEGOTIATE"
                        ? "bg-yellow-400/10 border-yellow-400 text-yellow-400"
                        : "bg-[#050505] border-gray-950 text-gray-500 hover:text-yellow-400"
                    }`}
                  >
                    NEGOTIATE
                  </button>
                </div>

                {/* Entry fields and buttons */}
                <form onSubmit={handlePostComment} className="flex space-x-2">
                  <input 
                    type="text"
                    placeholder={`DISPATCH ${replyType} REPLY...`}
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    className="flex-grow bg-[#050505] border border-gray-850 rounded px-3 py-2 text-xs font-mono text-white placeholder-gray-700 uppercase tracking-wider focus:outline-none focus:border-[#0FF]/60 transition-all"
                    maxLength={280}
                  />
                  <button
                    type="submit"
                    disabled={!replyText.trim()}
                    className={`px-4 py-2 border rounded text-xs font-black tracking-widest uppercase cursor-pointer flex items-center space-x-1 transition-all ${
                      !replyText.trim()
                        ? "bg-gray-950/40 border-gray-900 text-gray-600 cursor-not-allowed"
                        : "bg-[#0FF] hover:bg-[#0FF]/80 text-black border-[#0FF]"
                    }`}
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">DISPATCH</span>
                  </button>
                </form>

                {/* Core Negotiation Propose CTA */}
                {selectedIdea.deviceCode !== myDna.toUpperCase() && !selectedIdea.isArchived && (
                  <div className="mt-2.5 flex items-center justify-between bg-yellow-400/5 border border-yellow-400/10 p-2 rounded">
                    <span className="text-[8px] text-yellow-400 uppercase tracking-widest font-bold">
                      // READY TO LOCK ROLES, EQUITY, OR PILOT STEPS?
                    </span>
                    <button
                      onClick={() => {
                        setCounteringProposal(null);
                        setProposalContribution("");
                        setProposalRequest("");
                        setProposalRole("");
                        setProposalNextStep("");
                        setProposalTimeframe("");
                        setProposalOwnership("");
                        setShowProposalModal(true);
                      }}
                      className="px-2.5 py-1 bg-yellow-400 hover:bg-yellow-300 text-black font-black text-[9px] tracking-widest rounded transition-all cursor-pointer uppercase flex items-center gap-1"
                    >
                      <span>PROPOSE NEXT STEP</span>
                    </button>
                  </div>
                )}

              </div>

            </div>

          </div>
        )}

      </div>

      {/* ================= EDITING IDEA MODAL / DRAWER ================= */}
      {editingIdea && createPortal(
        <AnimatePresence>
          {editingIdea && (
            <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 z-[9999] font-mono overflow-y-auto">
              <motion.div 
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="border border-dashed border-[#0FF] rounded-lg p-6 bg-black max-w-2xl w-full max-h-[90vh] overflow-y-auto space-y-4 my-auto relative"
              >
                <div className="flex items-center justify-between border-b border-gray-900 pb-3 mb-2">
                  <h3 className="text-xs font-black text-[#0FF] tracking-widest uppercase flex items-center gap-1.5">
                    <Edit3 className="w-4 h-4" />
                    <span>EDIT TRANSMISSION RECORD</span>
                  </h3>
                  <button 
                    onClick={() => setEditingIdea(null)}
                    className="p-1 hover:bg-gray-900 rounded text-gray-500 hover:text-white cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <form onSubmit={handleSaveEdit} className="space-y-4">
                  <div>
                    <label className="block text-[9px] text-[#0FF] font-black uppercase tracking-wider mb-1.5">Title</label>
                    <input 
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="w-full bg-[#0d0d0d] border border-gray-800 rounded px-3 py-2 text-xs text-white uppercase tracking-wider focus:outline-none focus:border-[#0FF]/60 transition-all"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] text-gray-500 font-bold uppercase tracking-wider mb-1.5">Short Summary (Pitch)</label>
                    <textarea 
                      value={editSummary}
                      onChange={(e) => setEditSummary(e.target.value)}
                      className="w-full h-16 bg-[#0d0d0d] border border-gray-800 rounded px-3 py-2 text-xs text-white uppercase tracking-wider focus:outline-none focus:border-[#0FF]/60 transition-all resize-none"
                      maxLength={180}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] text-gray-500 font-bold uppercase tracking-wider mb-1.5">Friction / Problem Solved</label>
                    <textarea 
                      value={editProblem}
                      onChange={(e) => setEditProblem(e.target.value)}
                      className="w-full h-20 bg-[#0d0d0d] border border-gray-800 rounded px-3 py-2 text-xs text-white uppercase tracking-wider focus:outline-none focus:border-[#0FF]/60 transition-all"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] text-gray-500 font-bold uppercase tracking-wider mb-1.5">Target Users</label>
                    <textarea 
                      value={editTargetUsers}
                      onChange={(e) => setEditTargetUsers(e.target.value)}
                      className="w-full h-20 bg-[#0d0d0d] border border-gray-800 rounded px-3 py-2 text-xs text-white uppercase tracking-wider focus:outline-none focus:border-[#0FF]/60 transition-all"
                      required
                    />
                  </div>

                  <div className="flex items-center justify-end space-x-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setEditingIdea(null)}
                      className="px-3 py-1.5 bg-transparent border border-gray-800 rounded text-gray-500 text-[10px] font-black tracking-widest uppercase hover:text-white cursor-pointer"
                    >
                      CANCEL
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 bg-[#0FF] hover:bg-[#0FF]/80 text-black border border-[#0FF] rounded text-[10px] font-black tracking-widest uppercase cursor-pointer"
                    >
                      SAVE CHANGES
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* ================= PROPOSAL MODAL ================= */}
      {showProposalModal && selectedIdea && createPortal(
        <AnimatePresence>
          {showProposalModal && selectedIdea && (
            <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 z-[9999] font-mono overflow-y-auto">
              <motion.div 
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="border border-dashed border-yellow-400 rounded-lg p-6 bg-black max-w-2xl w-full max-h-[90vh] overflow-y-auto space-y-4 my-auto relative"
              >
              <div className="flex items-center justify-between border-b border-gray-900 pb-3 mb-1">
                <h3 className="text-xs font-black text-yellow-400 tracking-widest uppercase flex items-center gap-1.5">
                  <Users className="w-4 h-4 animate-pulse" />
                  <span>{counteringProposal ? "DISPATCH COUNTER-PROPOSAL ENVELOPE" : "DISPATCH FORMAL COLLABORATION PROPOSAL"}</span>
                </h3>
                <button 
                  onClick={() => setShowProposalModal(false)}
                  className="p-1 hover:bg-gray-900 rounded text-gray-500 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Legal disclaimer in specify block */}
              <div className="bg-yellow-400/5 border border-yellow-400/20 p-3 rounded text-[9.5px] leading-relaxed text-gray-400 select-none">
                <strong className="text-yellow-400 font-black block tracking-wider uppercase mb-1">// SYSTEM DISMISSAL NOTICE</strong>
                ALL PROPOSALS ARE INFORMAL DISCUSSION ONLY. PHANTOM CHAT DOES NOT CREATE LEGAL CONTRACTS OR PROVIDE LEGAL, FINANCIAL, INVESTMENT, OR TAX ADVICE. DO NOT SHARE PASSWORDS, PRIVATE KEYS, BANK DETAILS, IDENTITY DOCUMENTS, OR CONFIDENTIAL BUSINESS SECRETS.
              </div>

              <form onSubmit={handleSendProposal} className="space-y-4">
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Proposed Role */}
                  <div>
                    <label className="block text-[9px] text-yellow-400 font-black uppercase tracking-wider mb-1.5">
                      1. Proposed Role / Title *
                    </label>
                    <input 
                      type="text"
                      placeholder="E.G. TECHNICAL CO-FOUNDER, MARKETING LEAD..."
                      value={proposalRole}
                      onChange={(e) => setProposalRole(e.target.value)}
                      className="w-full bg-[#0d0d0d] border border-gray-850 rounded px-3 py-2 text-xs text-white uppercase placeholder-gray-800 tracking-wider focus:outline-none focus:border-yellow-400/60 transition-all"
                      required
                    />
                  </div>

                  {/* Timeframe */}
                  <div>
                    <label className="block text-[9px] text-gray-500 font-bold uppercase tracking-wider mb-1.5">
                      2. Optional Timeframe / Commitment
                    </label>
                    <input 
                      type="text"
                      placeholder="E.G. 10 HOURS/WEEK, 3 MONTH PILOT..."
                      value={proposalTimeframe}
                      onChange={(e) => setProposalTimeframe(e.target.value)}
                      className="w-full bg-[#0d0d0d] border border-gray-850 rounded px-3 py-2 text-xs text-white uppercase placeholder-gray-800 tracking-wider focus:outline-none focus:border-yellow-400/60 transition-all"
                    />
                  </div>
                </div>

                {/* Contribution */}
                <div>
                  <label className="block text-[9px] text-yellow-400 font-black uppercase tracking-wider mb-1.5">
                    3. What will you contribute? *
                  </label>
                  <textarea 
                    placeholder="DESCRIBE SKILLSETS, COMPLETED API MODULES, DESIGN WORK, MARKETING ASSETS..."
                    value={proposalContribution}
                    onChange={(e) => setProposalContribution(e.target.value)}
                    className="w-full h-20 bg-[#0d0d0d] border border-gray-850 rounded px-3 py-2 text-xs text-white uppercase placeholder-gray-800 tracking-wider focus:outline-none focus:border-yellow-400/60 transition-all"
                    required
                  />
                </div>

                {/* Request */}
                <div>
                  <label className="block text-[9px] text-yellow-400 font-black uppercase tracking-wider mb-1.5">
                    4. What do you need in return? *
                  </label>
                  <textarea 
                    placeholder="E.G. 50% EQUITY SPLIT, CONSULTING COMPENSATION, EQUIVALENT WORK CONTRIBUTION..."
                    value={proposalRequest}
                    onChange={(e) => setProposalRequest(e.target.value)}
                    className="w-full h-20 bg-[#0d0d0d] border border-gray-850 rounded px-3 py-2 text-xs text-white uppercase placeholder-gray-800 tracking-wider focus:outline-none focus:border-yellow-400/60 transition-all"
                    required
                  />
                </div>

                {/* Next Step */}
                <div>
                  <label className="block text-[9px] text-yellow-400 font-black uppercase tracking-wider mb-1.5">
                    5. Proposed immediate next step *
                  </label>
                  <textarea 
                    placeholder="DESCRIBE ONE SPECIFIC FIRST ACTION: E.G., COMPILE REACT CODE BY FRIDAY, PREPARE 5 BETA INTERVIEW QUESTIONS..."
                    value={proposalNextStep}
                    onChange={(e) => setProposalNextStep(e.target.value)}
                    className="w-full h-16 bg-[#0d0d0d] border border-gray-850 rounded px-3 py-2 text-xs text-white uppercase placeholder-gray-800 tracking-wider focus:outline-none focus:border-yellow-400/60 transition-all resize-none"
                    required
                  />
                </div>

                {/* Ownership split */}
                <div>
                  <label className="block text-[9px] text-gray-500 font-bold uppercase tracking-wider mb-1.5">
                    6. Ownership Structure Notes
                  </label>
                  <textarea 
                    placeholder="E.G. EQUAL EQUITY VESTING, SLICING PIE MODEL, DISCUSSION ONLY..."
                    value={proposalOwnership}
                    onChange={(e) => setProposalOwnership(e.target.value)}
                    className="w-full h-16 bg-[#0d0d0d] border border-gray-850 rounded px-3 py-2 text-xs text-white uppercase placeholder-gray-800 tracking-wider focus:outline-none focus:border-yellow-400/60 transition-all resize-none"
                  />
                </div>

                {proposalError && (
                  <div className="p-3 bg-red-950/20 border border-red-500/20 rounded text-[10px] text-red-400 font-bold leading-normal">
                    [ERROR] {proposalError}
                  </div>
                )}

                {proposalSuccess && (
                  <div className="p-3 bg-emerald-950/20 border border-emerald-500/20 rounded text-[10px] text-emerald-400 font-bold leading-normal">
                    ✓ [DISPATCH SECURED] Proposal transmitted successfully. Synchronizing peer inbox...
                  </div>
                )}

                <div className="flex items-center justify-end space-x-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowProposalModal(false)}
                    className="px-3 py-1.5 bg-transparent border border-gray-850 text-gray-500 rounded text-[10px] font-black tracking-widest uppercase hover:text-white cursor-pointer"
                  >
                    CANCEL
                  </button>
                  <button
                    type="submit"
                    disabled={proposalSuccess}
                    className={`px-4 py-2 rounded text-[10px] font-black tracking-widest uppercase cursor-pointer flex items-center gap-1 ${
                      proposalSuccess 
                        ? "bg-gray-950 text-gray-600 cursor-not-allowed border-gray-900" 
                        : "bg-yellow-400 hover:bg-yellow-300 text-black border border-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.2)]"
                    }`}
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{counteringProposal ? "DISPATCH COUNTER" : "DISPATCH PROPOSAL"}</span>
                  </button>
                </div>

              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>,
      document.body
    )}

      {/* ================= IN-APP REPORT MODAL ================= */}
      {reportTarget && createPortal(
        <AnimatePresence>
          {reportTarget && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-[#050505] border border-red-500/40 rounded-xl p-5 sm:p-6 max-w-md w-full shadow-[0_0_30px_rgba(239,68,68,0.15)] relative my-auto"
              >
                <div className="flex items-center justify-between border-b border-gray-900 pb-3 mb-4">
                  <div className="flex items-center space-x-2">
                    <ShieldAlert className="w-5 h-5 text-red-400 animate-pulse" />
                    <span className="text-xs font-black text-white tracking-widest uppercase">
                      [ MODERATION REPORT ]
                    </span>
                  </div>
                  <button
                    onClick={() => { setReportTarget(null); setReportResult(null); }}
                    className="text-gray-500 hover:text-white p-1 rounded transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {reportResult ? (
                  <div className="text-center py-4 space-y-3">
                    <CheckCircle className="w-10 h-10 text-emerald-400 mx-auto" />
                    <div className="text-xs font-black text-white tracking-widest uppercase">
                      REPORT SECURELY LOGGED
                    </div>
                    <div className="bg-black/60 border border-gray-800 rounded p-3 text-[11px] font-mono text-gray-300 space-y-1 text-left">
                      <div><span className="text-gray-500 font-bold">REFERENCE:</span> <span className="text-[#0FF] font-black">{reportResult.reference}</span></div>
                      <div><span className="text-gray-500 font-bold">STATUS:</span> <span className="text-yellow-400 font-black">{reportResult.status}</span></div>
                      <div className="text-[10px] text-gray-500 pt-1">
                        The target content snapshot has been queued for administrative review. The author's identity is safely restricted to authorized operators.
                      </div>
                    </div>
                    <button
                      onClick={() => { setReportTarget(null); setReportResult(null); }}
                      className="w-full py-2 bg-[#0d0d0d] border border-gray-800 hover:border-gray-700 text-gray-300 rounded text-xs font-black tracking-widest uppercase mt-2"
                    >
                      CLOSE
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmitReport} className="space-y-4">
                    <div className="text-[10px] text-gray-400 uppercase tracking-wider">
                      Reporting <strong className="text-white">{reportTarget.type}</strong> {reportTarget.title ? `"${reportTarget.title}"` : ""}.
                    </div>

                    <div>
                      <label className="block text-[9px] text-gray-400 font-bold uppercase tracking-widest mb-1.5">
                        VIOLATION CATEGORY *
                      </label>
                      <select
                        value={reportReason}
                        onChange={(e) => setReportReason(e.target.value)}
                        className="w-full bg-[#0d0d0d] border border-gray-800 rounded px-3 py-2 text-xs text-white uppercase focus:outline-none focus:border-red-500/60"
                      >
                        <option value="SPAM">SPAM / UNWANTED PROMOTION</option>
                        <option value="INAPPROPRIATE">INAPPROPRIATE / HARMFUL CONTENT</option>
                        <option value="HARASSMENT">HARASSMENT / THREATS</option>
                        <option value="SCAM">SCAM / FINANCIAL MISINFORMATION</option>
                        <option value="COPYRIGHT">INTELLECTUAL PROPERTY / PLAGIARISM</option>
                        <option value="OTHER">OTHER OPERATIONAL CONCERN</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[9px] text-gray-400 font-bold uppercase tracking-widest mb-1.5">
                        EXPLANATION (OPTIONAL)
                      </label>
                      <textarea
                        value={reportExplanation}
                        onChange={(e) => setReportExplanation(e.target.value)}
                        placeholder="PROVIDE ADDITIONAL CONTEXT FOR THE MODERATION OPERATORS..."
                        className="w-full h-20 bg-[#0d0d0d] border border-gray-800 rounded p-2.5 text-xs text-white uppercase placeholder-gray-700 tracking-wider focus:outline-none focus:border-red-500/60 resize-none"
                      />
                    </div>

                    {reportError && (
                      <div className="text-[10px] text-red-400 font-bold">
                        [ERROR] {reportError}
                      </div>
                    )}

                    <div className="flex items-center justify-end space-x-2 pt-2 border-t border-gray-900">
                      <button
                        type="button"
                        onClick={() => setReportTarget(null)}
                        className="px-3 py-1.5 border border-gray-850 text-gray-500 hover:text-white rounded text-[10px] font-black tracking-widest uppercase cursor-pointer"
                      >
                        CANCEL
                      </button>
                      <button
                        type="submit"
                        disabled={reportSubmitting}
                        className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded text-[10px] font-black tracking-widest uppercase flex items-center space-x-1.5 shadow-[0_0_12px_rgba(239,68,68,0.3)] disabled:opacity-50 cursor-pointer"
                      >
                        {reportSubmitting ? (
                          <span>TRANSMITTING...</span>
                        ) : (
                          <>
                            <ShieldAlert className="w-3.5 h-3.5" />
                            <span>SUBMIT REPORT</span>
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                )}
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* ================= IN-APP CONFIRMATION MODAL ================= */}
      {confirmDialog && createPortal(
        <AnimatePresence>
          {confirmDialog && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-[#050505] border border-yellow-400/40 rounded-xl p-5 sm:p-6 max-w-sm w-full shadow-[0_0_25px_rgba(250,204,21,0.15)] relative my-auto"
              >
                <div className="flex items-center space-x-2 border-b border-gray-900 pb-3 mb-3">
                  <AlertTriangle className="w-5 h-5 text-yellow-400" />
                  <h4 className="text-xs font-black text-white tracking-widest uppercase">
                    {confirmDialog.title}
                  </h4>
                </div>
                <p className="text-xs text-gray-400 leading-relaxed font-sans mb-5">
                  {confirmDialog.message}
                </p>
                <div className="flex items-center justify-end space-x-2">
                  <button
                    onClick={() => setConfirmDialog(null)}
                    className="px-3 py-1.5 border border-gray-850 text-gray-400 hover:text-white rounded text-[10px] font-black tracking-widest uppercase cursor-pointer"
                  >
                    CANCEL
                  </button>
                  <button
                    onClick={() => {
                      const fn = confirmDialog.onConfirm;
                      setConfirmDialog(null);
                      fn();
                    }}
                    className="px-4 py-2 bg-yellow-400 hover:bg-yellow-300 text-black font-black rounded text-[10px] tracking-widest uppercase shadow-[0_0_10px_rgba(250,204,21,0.2)] cursor-pointer"
                  >
                    {confirmDialog.confirmLabel}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* Toast Notice */}
      <AnimatePresence>
        {selfNegotiateNotice && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#0c0c0c] border border-yellow-400/40 text-yellow-400 text-xs font-mono px-4 py-2.5 rounded-lg shadow-lg flex items-center space-x-2"
          >
            <AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0" />
            <span>You cannot initiate a negotiation with your own idea transmission.</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
