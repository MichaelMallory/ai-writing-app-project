import { db } from '@/lib/firebase';
import { 
  collection, 
  doc, 
  getDocs, 
  getDoc,
  query, 
  where, 
  orderBy,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { 
  Chapter, 
  ChapterEntityConnection, 
  Entity, 
  ChapterWithRelationships,
  ChapterBeat,
  ChapterNote
} from './types';

// Create a new chapter
export async function createChapter(projectId: string, title: string, order: number): Promise<Chapter> {
  const chaptersRef = collection(db, 'chapters');
  const chapterData = {
    projectId,
    title,
    order,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  
  const docRef = await addDoc(chaptersRef, chapterData);
  return {
    id: docRef.id,
    ...chapterData,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

// Get all chapters for a project
export async function getProjectChapters(projectId: string): Promise<Chapter[]> {
  const chaptersRef = collection(db, 'chapters');
  const q = query(
    chaptersRef,
    where('projectId', '==', projectId),
    orderBy('order')
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    createdAt: doc.data().createdAt?.toDate(),
    updatedAt: doc.data().updatedAt?.toDate(),
  })) as Chapter[];
}

// Get a single chapter with all its entity relationships
export async function getChapterWithRelationships(chapterId: string): Promise<ChapterWithRelationships> {
  // Get the chapter
  const chapterRef = doc(db, 'chapters', chapterId);
  const chapterDoc = await getDoc(chapterRef);
  if (!chapterDoc.exists()) {
    throw new Error('Chapter not found');
  }
  
  const chapter = {
    id: chapterDoc.id,
    ...chapterDoc.data(),
    createdAt: chapterDoc.data().createdAt?.toDate(),
    updatedAt: chapterDoc.data().updatedAt?.toDate(),
  } as Chapter;
  
  // Get all connections for this chapter
  const connectionsRef = collection(db, 'chapterEntityConnections');
  const q = query(connectionsRef, where('chapterId', '==', chapterId));
  const connectionsSnapshot = await getDocs(q);
  
  // Get beats and notes
  const [beats, notes] = await Promise.all([
    getChapterBeats(chapterId),
    getChapterNotes(chapterId)
  ]);
  
  // If there are no connections, return early with just beats and notes
  if (connectionsSnapshot.empty) {
    return {
      ...chapter,
      connections: {
        characters: [],
        settings: [],
        plotPoints: [],
      },
      beats,
      notes,
    };
  }
  
  // Group connections by type
  const connectionsByType = {
    character: [] as string[],
    setting: [] as string[],
    plotPoint: [] as string[],
  };
  
  connectionsSnapshot.docs.forEach(doc => {
    const connection = doc.data() as ChapterEntityConnection;
    connectionsByType[connection.entityType].push(connection.entityId);
  });
  
  // Fetch entities for each type from their respective collections
  const connections = {
    characters: [] as Entity[],
    settings: [] as Entity[],
    plotPoints: [] as Entity[],
  };
  
  // Fetch characters
  if (connectionsByType.character.length > 0) {
    const charactersRef = collection(db, 'characters');
    const charactersSnapshot = await Promise.all(
      connectionsByType.character.map(id => getDoc(doc(db, 'characters', id)))
    );
    connections.characters = charactersSnapshot
      .filter(doc => doc.exists())
      .map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          type: 'character',
          name: data?.name,
          metadata: {
            description: data?.description,
            aliases: data?.aliases || [],
            attributes: data?.attributes || {},
            relationships: data?.relationships || []
          },
          projectId: data?.projectId,
          createdAt: data?.createdAt?.toDate(),
          updatedAt: data?.updatedAt?.toDate(),
        };
      });
  }
  
  // Fetch locations (settings)
  if (connectionsByType.setting.length > 0) {
    const locationsRef = collection(db, 'locations');
    const locationsSnapshot = await Promise.all(
      connectionsByType.setting.map(id => getDoc(doc(db, 'locations', id)))
    );
    connections.settings = locationsSnapshot
      .filter(doc => doc.exists())
      .map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          type: 'setting',
          name: data?.name,
          metadata: {
            description: data?.description,
            attributes: {
              type: data?.type,
              features: data?.features || [],
              significance: data?.significance || [],
            }
          },
          projectId: data?.projectId,
          createdAt: data?.createdAt?.toDate(),
          updatedAt: data?.updatedAt?.toDate(),
        };
      });
  }
  
  // Fetch events (plot points)
  if (connectionsByType.plotPoint.length > 0) {
    const eventsRef = collection(db, 'events');
    const eventsSnapshot = await Promise.all(
      connectionsByType.plotPoint.map(id => getDoc(doc(db, 'events', id)))
    );
    connections.plotPoints = eventsSnapshot
      .filter(doc => doc.exists())
      .map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          type: 'plotPoint',
          name: data?.name,
          metadata: {
            description: data?.description,
            attributes: {
              type: data?.type,
              events: data?.events || [],
              impact: data?.impact || [],
              connections: data?.connections || [],
            }
          },
          projectId: data?.projectId,
          createdAt: data?.createdAt?.toDate(),
          updatedAt: data?.updatedAt?.toDate(),
        };
      });
  }
  
  return {
    ...chapter,
    connections,
    beats,
    notes,
  };
}

// Update chapter order
export async function updateChapterOrder(chapterId: string, newOrder: number): Promise<void> {
  const chapterRef = doc(db, 'chapters', chapterId);
  await updateDoc(chapterRef, {
    order: newOrder,
    updatedAt: serverTimestamp()
  });
}

// Delete chapter and its connections
export async function deleteChapter(chapterId: string): Promise<void> {
  // Delete the chapter
  const chapterRef = doc(db, 'chapters', chapterId);
  await deleteDoc(chapterRef);
  
  // Delete all connections, beats, and notes for this chapter
  const [connectionsRef, beatsRef, notesRef] = [
    collection(db, 'chapterEntityConnections'),
    collection(db, 'chapterBeats'),
    collection(db, 'chapterNotes')
  ];
  
  const [connectionsQuery, beatsQuery, notesQuery] = [
    query(connectionsRef, where('chapterId', '==', chapterId)),
    query(beatsRef, where('chapterId', '==', chapterId)),
    query(notesRef, where('chapterId', '==', chapterId))
  ];
  
  const [connectionsSnapshot, beatsSnapshot, notesSnapshot] = await Promise.all([
    getDocs(connectionsQuery),
    getDocs(beatsQuery),
    getDocs(notesQuery)
  ]);
  
  const deletePromises = [
    ...connectionsSnapshot.docs.map(doc => deleteDoc(doc.ref)),
    ...beatsSnapshot.docs.map(doc => deleteDoc(doc.ref)),
    ...notesSnapshot.docs.map(doc => deleteDoc(doc.ref))
  ];
  
  await Promise.all(deletePromises);
}

// Update chapter title
export async function updateChapterTitle(chapterId: string, newTitle: string): Promise<void> {
  const chapterRef = doc(db, 'chapters', chapterId);
  await updateDoc(chapterRef, {
    title: newTitle,
    updatedAt: serverTimestamp()
  });
}

// Add an entity to a chapter
export async function addEntityToChapter(
  chapterId: string,
  entityId: string,
  entityType: 'character' | 'setting' | 'plotPoint',
  projectId: string
): Promise<ChapterEntityConnection> {
  const connectionsRef = collection(db, 'chapterEntityConnections');
  
  // Check if connection already exists
  const q = query(
    connectionsRef,
    where('chapterId', '==', chapterId),
    where('entityId', '==', entityId)
  );
  const existingConnections = await getDocs(q);
  
  if (!existingConnections.empty) {
    throw new Error('Entity is already connected to this chapter');
  }
  
  const connectionData = {
    chapterId,
    entityId,
    entityType,
    projectId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  
  const docRef = await addDoc(connectionsRef, connectionData);
  return {
    id: docRef.id,
    ...connectionData,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

// Remove an entity from a chapter
export async function removeEntityFromChapter(chapterId: string, entityId: string): Promise<void> {
  const connectionsRef = collection(db, 'chapterEntityConnections');
  const q = query(
    connectionsRef,
    where('chapterId', '==', chapterId),
    where('entityId', '==', entityId)
  );
  
  const snapshot = await getDocs(q);
  if (snapshot.empty) {
    throw new Error('Connection not found');
  }
  
  // Delete all matching connections (should only be one)
  const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
  await Promise.all(deletePromises);
}

// Search entities by type and name
export async function searchEntities(
  projectId: string,
  type: 'character' | 'setting' | 'plotPoint',
  searchTerm: string
): Promise<Entity[]> {
  try {
    // Determine the collection based on type
    const collectionName = type === 'character' ? 'characters' :
                         type === 'setting' ? 'locations' :
                         'events';
    
    console.log(`Searching in collection: ${collectionName}`);
    const entitiesRef = collection(db, collectionName);
    const q = query(
      entitiesRef,
      where('projectId', '==', projectId)
    );
    
    const snapshot = await getDocs(q);
    console.log(`Found ${snapshot.docs.length} results`);
    
    const entities = snapshot.docs
      .map(doc => {
        const data = doc.data();
        console.log('Document data:', data);
        
        // For plot points (events), use title as name if name is not available
        const name = type === 'plotPoint' ? (data.name || data.title) : data.name;
        
        if (!name) {
          console.warn(`Entity ${doc.id} has no name or title`);
          return null;
        }
        
        const entity: Entity = {
          id: doc.id,
          type,
          name,
          metadata: {
            description: data.description,
            aliases: data.aliases || [],
            attributes: type === 'character' ? {
              // Character attributes
              personality: data.attributes?.personality || [],
              appearance: data.attributes?.appearance || [],
              background: data.attributes?.background || [],
            } : type === 'setting' ? {
              // Location attributes
              type: data.attributes?.type,
              features: data.attributes?.features || [],
              significance: data.attributes?.significance || [],
            } : {
              // Event/Plot Point attributes
              type: data.type,
              events: data.events || [],
              impact: data.impact || [],
              connections: data.connections || []
            }
          },
          projectId: data.projectId,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        };
        
        return entity;
      })
      .filter((entity): entity is Entity => entity !== null)
      .filter(entity => {
        const nameMatch = entity.name.toLowerCase().includes(searchTerm.toLowerCase());
        const aliasMatch = (entity.metadata.aliases || []).some(alias => 
          alias.toLowerCase().includes(searchTerm.toLowerCase())
        );
        const eventMatch = type === 'plotPoint' && 
          (entity.metadata.attributes?.events || []).some(event =>
            event.toLowerCase().includes(searchTerm.toLowerCase())
          );
        
        return nameMatch || aliasMatch || eventMatch;
      });
    
    console.log('Filtered entities:', entities);
    return entities;
  } catch (error) {
    console.error('Error searching entities:', error);
    throw error;
  }
}

// Create a new beat
export async function createChapterBeat(
  chapterId: string,
  projectId: string,
  title: string,
  content: string,
  order: number
): Promise<ChapterBeat> {
  const beatsRef = collection(db, 'chapterBeats');
  const beatData = {
    chapterId,
    projectId,
    title,
    content,
    order,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  
  const docRef = await addDoc(beatsRef, beatData);
  return {
    id: docRef.id,
    ...beatData,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

// Get all beats for a chapter
export async function getChapterBeats(chapterId: string): Promise<ChapterBeat[]> {
  const beatsRef = collection(db, 'chapterBeats');
  const q = query(
    beatsRef,
    where('chapterId', '==', chapterId)
  );
  
  const snapshot = await getDocs(q);
  const beats = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    createdAt: doc.data().createdAt?.toDate(),
    updatedAt: doc.data().updatedAt?.toDate(),
  })) as ChapterBeat[];
  
  // Sort in memory instead
  return beats.sort((a, b) => a.order - b.order);
}

// Update a beat
export async function updateChapterBeat(
  beatId: string,
  updates: Partial<Pick<ChapterBeat, 'title' | 'content' | 'order'>>
): Promise<void> {
  const beatRef = doc(db, 'chapterBeats', beatId);
  await updateDoc(beatRef, {
    ...updates,
    updatedAt: serverTimestamp()
  });
}

// Delete a beat
export async function deleteChapterBeat(beatId: string): Promise<void> {
  const beatRef = doc(db, 'chapterBeats', beatId);
  await deleteDoc(beatRef);
}

// Create a new note
export async function createChapterNote(
  chapterId: string,
  projectId: string,
  title: string,
  content: string
): Promise<ChapterNote> {
  const notesRef = collection(db, 'chapterNotes');
  const noteData = {
    chapterId,
    projectId,
    title,
    content,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  
  const docRef = await addDoc(notesRef, noteData);
  return {
    id: docRef.id,
    ...noteData,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

// Get all notes for a chapter
export async function getChapterNotes(chapterId: string): Promise<ChapterNote[]> {
  const notesRef = collection(db, 'chapterNotes');
  const q = query(
    notesRef,
    where('chapterId', '==', chapterId)
  );
  
  const snapshot = await getDocs(q);
  const notes = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    createdAt: doc.data().createdAt?.toDate(),
    updatedAt: doc.data().updatedAt?.toDate(),
  })) as ChapterNote[];
  
  // Sort in memory instead
  return notes.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

// Update a note
export async function updateChapterNote(
  noteId: string,
  updates: Partial<Pick<ChapterNote, 'title' | 'content'>>
): Promise<void> {
  const noteRef = doc(db, 'chapterNotes', noteId);
  await updateDoc(noteRef, {
    ...updates,
    updatedAt: serverTimestamp()
  });
}

// Delete a note
export async function deleteChapterNote(noteId: string): Promise<void> {
  const noteRef = doc(db, 'chapterNotes', noteId);
  await deleteDoc(noteRef);
}

// Update chapter content
export async function updateChapterContent(chapterId: string, content: string): Promise<void> {
  try {
    const chapterRef = doc(db, 'chapters', chapterId);
    await updateDoc(chapterRef, {
      content,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Error updating chapter content:', error);
    throw error;
  }
} 