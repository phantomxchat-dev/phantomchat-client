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
    }
  } catch (e) {}
  return true;
};

export const deleteDoc = async (_docRef: any) => {
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
