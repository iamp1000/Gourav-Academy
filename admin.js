// This script manages the admin panel, interacting with the Supabase backend.

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- State Management ---
let siteData = {
    hero: [],
    contact: {},
    coach: {},
    pricing: {},
    schedule: [],
    gallery: []
};

// --- UI Elements ---
const loadingOverlay = document.getElementById('loading-overlay');
const heroImagesInput = document.getElementById('heroImages');
const heroVideosInput = document.getElementById('heroVideos');
const coachImageInput = document.getElementById('coachImage');
const galleryImagesInput = document.getElementById('galleryImages');

// --- Main App Logic ---
document.addEventListener('DOMContentLoaded', () => {
    loadAllData();

    document.getElementById('logoutButton').addEventListener('click', logout);
    document.getElementById('saveHero').addEventListener('click', saveHeroData);
    document.getElementById('saveContact').addEventListener('click', saveContactData);
    document.getElementById('saveCoach').addEventListener('click', saveCoachData);
    document.getElementById('savePrices').addEventListener('click', savePricesData);
    document.getElementById('saveSchedule').addEventListener('click', saveScheduleData);
    document.getElementById('addScheduleRow').addEventListener('click', () => addScheduleRow());
    document.getElementById('uploadGalleryImage').addEventListener('click', saveGalleryData); // Changed button ID
});

async function loadAllData() {
    loadingOverlay.style.display = 'flex';
    try {
        const [contactRes, pricingRes, coachRes, heroRes, scheduleRes, galleryRes] = await Promise.all([
            supabase.from('contact').select('*').limit(1).single(),
            supabase.from('pricing').select('*').limit(1).single(),
            supabase.from('coach').select('*').limit(1).single(),
            supabase.from('hero_media').select('*').order('display_order'),
            supabase.from('schedule').select('*').order('display_order'),
            supabase.from('gallery').select('*').order('display_order')
        ]);

        siteData.contact = contactRes.data || {};
        siteData.pricing = pricingRes.data || {};
        siteData.coach = coachRes.data || {};
        siteData.hero = heroRes.data || [];
        siteData.schedule = scheduleRes.data || [];
        siteData.gallery = galleryRes.data || [];

        populateUI();
    } catch (error) {
        console.error("Error loading data: ", error);
        alert("Could not load website data. Check console for errors and ensure your Supabase tables have an 'id' primary key.");
    } finally {
        loadingOverlay.style.display = 'none';
    }
}

function populateUI() {
    document.getElementById('contactPhone').value = siteData.contact?.phone || '';
    document.getElementById('contactEmail').value = siteData.contact?.email || '';
    document.getElementById('contactAddress').value = siteData.contact?.address || '';
    document.getElementById('whatsappNumber').value = siteData.contact?.whatsapp || '';

    document.getElementById('priceBeginner').value = siteData.pricing?.beginner || '';
    document.getElementById('priceIntermediate').value = siteData.pricing?.intermediate || '';
    document.getElementById('priceAdvanced').value = siteData.pricing?.advanced || '';

    renderImagePreview('coachImagePreview', siteData.coach?.image_url);
    renderMediaPreview('heroImagesPreview', siteData.hero.filter(m => m.media_type === 'image'), 'image');
    renderMediaPreview('heroVideosPreview', siteData.hero.filter(m => m.media_type === 'video'), 'video');
    renderSchedule();
    renderGalleryPreview();
}

// --- SAVE FUNCTIONS (with UPSERT) ---

async function saveContactData() {
    const contactInfo = {
        id: siteData.contact?.id || 1,
        phone: document.getElementById('contactPhone').value,
        email: document.getElementById('contactEmail').value,
        address: document.getElementById('contactAddress').value,
        whatsapp: document.getElementById('whatsappNumber').value
    };
    const { error } = await supabase.from('contact').upsert(contactInfo, { onConflict: 'id' });
    handleSaveResponse(error);
}

async function savePricesData() {
    const pricingInfo = {
        id: siteData.pricing?.id || 1,
        beginner: document.getElementById('priceBeginner').value,
        intermediate: document.getElementById('priceIntermediate').value,
        advanced: document.getElementById('priceAdvanced').value,
    };
    const { error } = await supabase.from('pricing').upsert(pricingInfo, { onConflict: 'id' });
    handleSaveResponse(error);
}

async function saveCoachData() {
    loadingOverlay.style.display = 'flex';
    const file = coachImageInput.files[0];

    try {
        if (!file) {
            alert("No new image was selected. To update, please choose a file.");
            return;
        }

        const newImageUrl = await uploadFile(file, 'coach');
        const coachInfo = {
            id: siteData.coach?.id || 1,
            image_url: newImageUrl
        };
        const { error } = await supabase.from('coach').upsert(coachInfo, { onConflict: 'id' });
        if (error) throw error;

        siteData.coach.image_url = newImageUrl;
        renderImagePreview('coachImagePreview', newImageUrl);
        alert('Coach image saved successfully!');
    } catch (error) {
        handleSaveResponse(error);
    } finally {
        loadingOverlay.style.display = 'none';
    }
}

async function saveScheduleData() {
    loadingOverlay.style.display = 'flex';
    const container = document.getElementById('scheduleContainer');
    const rows = container.querySelectorAll('.schedule-row');
    const scheduleToSave = Array.from(rows).map((row, index) => ({
        id: row.dataset.id ? parseInt(row.dataset.id) : undefined,
        day: row.querySelector('[data-type="day"]').value,
        time: row.querySelector('[data-type="time"]').value,
        program: row.querySelector('[data-type="program"]').value,
        coach_name: row.querySelector('[data-type="coach"]').value,
        display_order: index
    }));

    const newRows = scheduleToSave.filter(row => !row.id);
    const updatedRows = scheduleToSave.filter(row => row.id);

    try {
        const currentIds = updatedRows.map(r => r.id);
        const initialIds = siteData.schedule.map(r => r.id);
        const deletedIds = initialIds.filter(id => !currentIds.includes(id));

        if (deletedIds.length > 0) {
            await supabase.from('schedule').delete().in('id', deletedIds);
        }
        if (updatedRows.length > 0) {
            await supabase.from('schedule').upsert(updatedRows, { onConflict: 'id' });
        }
        if (newRows.length > 0) {
            const rowsToInsert = newRows.map(({ id, ...rest }) => rest);
            await supabase.from('schedule').insert(rowsToInsert);
        }

        alert('Schedule saved successfully!');
        await loadAllData();
    } catch (error) {
        handleSaveResponse(error);
    } finally {
        loadingOverlay.style.display = 'none';
    }
}

async function saveHeroData() {
    loadingOverlay.style.display = 'flex';
    const imageFiles = heroImagesInput.files;
    const videoFiles = heroVideosInput.files;

    if (imageFiles.length === 0 && videoFiles.length === 0) {
        alert("No new images or videos selected.");
        loadingOverlay.style.display = 'none';
        return;
    }

    try {
        const imageRecords = (await uploadMultipleFiles(imageFiles, 'hero')).map((url, i) => ({ url, media_type: 'image', display_order: siteData.hero.length + i }));
        const videoRecords = (await uploadMultipleFiles(videoFiles, 'hero')).map((url, i) => ({ url, media_type: 'video', display_order: siteData.hero.length + imageFiles.length + i }));

        const allRecords = [...imageRecords, ...videoRecords];
        if (allRecords.length > 0) {
            const { error } = await supabase.from('hero_media').insert(allRecords);
            if (error) throw error;
        }
        alert('Hero media saved successfully!');
        await loadAllData();
    } catch (error) {
        handleSaveResponse(error);
    } finally {
        loadingOverlay.style.display = 'none';
    }
}

// --- UPDATED GALLERY SAVE FUNCTION ---
async function saveGalleryData() {
    loadingOverlay.style.display = 'flex';
    const fileInput = document.getElementById('galleryImageFile');
    const file = fileInput.files[0];

    if (!file) {
        alert("Please select an image file to upload.");
        loadingOverlay.style.display = 'none';
        return;
    }
    try {
        const imageUrl = await uploadFile(file, 'gallery');
        const highestOrder = siteData.gallery.length > 0 ? Math.max(...siteData.gallery.map(g => g.display_order || 0)) : 0;

        const newRecord = {
            image_url: imageUrl,
            category: document.getElementById('galleryCategory').value,
            title: document.getElementById('galleryTitle').value,
            description: document.getElementById('galleryDescription').value,
            display_order: highestOrder + 1
        };

        const { error } = await supabase.from('gallery').insert(newRecord);
        if (error) throw error;

        alert('Gallery image uploaded successfully!');

        // Clear inputs after upload
        fileInput.value = '';
        document.getElementById('galleryTitle').value = '';
        document.getElementById('galleryDescription').value = '';

        await loadAllData(); // Reload all data to show the new image
    } catch (error) {
        handleSaveResponse(error);
    } finally {
        loadingOverlay.style.display = 'none';
    }
}

// --- RENDER & DELETE FUNCTIONS ---

function renderImagePreview(elementId, url) {
    const container = document.getElementById(elementId);
    //  единственное изменение здесь: 'object-cover' заменен на 'object-contain'
    // This ensures the entire image is visible, preventing it from being cropped.
    container.innerHTML = url ? `<img src="${url}" class="w-full h-full object-contain">` : `<div class="w-full h-full bg-gray-200 flex items-center justify-center text-gray-500 text-sm">No Image</div>`;
}

function renderMediaPreview(containerId, items, type) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    items.forEach(item => {
        const wrapper = document.createElement('div');
        wrapper.className = 'relative group';
        wrapper.innerHTML = `
            ${type === 'image' ? `<img src="${item.url}" class="w-full h-32 object-cover rounded-lg">` : `<video src="${item.url}" class="w-full h-32 object-cover rounded-lg" controls></video>`}
            <button class="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center font-bold opacity-0 group-hover:opacity-100 transition-opacity">&times;</button>
        `;
        wrapper.querySelector('button').onclick = () => deleteMediaItem('hero_media', item);
        container.appendChild(wrapper);
    });
}

// --- UPDATED GALLERY PREVIEW FUNCTION ---
function renderGalleryPreview() {
    const container = document.getElementById('galleryImagesPreview');
    container.innerHTML = `
        <h3 class="text-lg font-semibold col-span-full mb-2">Current Gallery Images</h3>
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            ${siteData.gallery.length === 0 ? '<p class="text-gray-500 col-span-full">No images in the gallery yet.</p>' : ''}
            ${siteData.gallery.sort((a, b) => (a.display_order || 0) - (b.display_order || 0)).map(item => `
                <div class="relative group">
                    <img src="${item.image_url}" class="w-full h-32 object-cover rounded-lg">
                    <div class="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-center p-2">
                        <p class="text-white text-xs font-bold">${item.title || 'No Title'}</p>
                        <p class="text-white text-xs">${item.category}</p>
                    </div>
                    <button class="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center font-bold">&times;</button>
                </div>
            `).join('')}
        </div>`;

    container.querySelectorAll('button').forEach((button, index) => {
        const sortedItem = siteData.gallery.sort((a, b) => (a.display_order || 0) - (b.display_order || 0))[index];
        button.onclick = () => deleteMediaItem('gallery', sortedItem);
    });
}

function renderSchedule() {
    const container = document.getElementById('scheduleContainer');
    container.innerHTML = '';
    (siteData.schedule || []).forEach(item => addScheduleRow(item));
    if (!siteData.schedule || siteData.schedule.length === 0) {
        addScheduleRow();
    }
}

function addScheduleRow(item = {}) {
    const container = document.getElementById('scheduleContainer');
    const div = document.createElement('div');
    div.className = 'schedule-row grid grid-cols-1 md:grid-cols-5 gap-4 items-center border p-4 rounded-lg';
    if (item.id) {
        div.dataset.id = item.id;
    }
    div.innerHTML = `
        <input type="text" data-type="day" class="input" placeholder="Day" value="${item.day || ''}">
        <input type="text" data-type="time" class="input" placeholder="Time" value="${item.time || ''}">
        <input type="text" data-type="program" class="input" placeholder="Program" value="${item.program || ''}">
        <input type="text" data-type="coach" class="input" placeholder="Coach" value="${item.coach_name || ''}">
        <button class="btn btn-danger remove-schedule-row">Remove</button>
    `;
    div.querySelector('.remove-schedule-row').addEventListener('click', () => div.remove());
    container.appendChild(div);
}

async function deleteMediaItem(tableName, item) {
    if (!confirm('Are you sure you want to delete this item?')) return;
    loadingOverlay.style.display = 'flex';

    try {
        // FIX: Use the correct column name 'image_url'
        const url = item.url || item.image_url;
        if (!url) throw new Error("Item URL is missing, cannot delete from storage.");

        const filePath = new URL(url).pathname.split('/media/').pop();

        await supabase.storage.from('media').remove([decodeURIComponent(filePath)]);
        await supabase.from(tableName).delete().eq('id', item.id);

        alert('Item deleted successfully!');
        await loadAllData();
    } catch (error) {
        console.error(`Error deleting from ${tableName}:`, error);
        alert(`DELETE FAILED: ${error.message}`);
    } finally {
        loadingOverlay.style.display = 'none';
    }
}

// --- UTILITIES ---

async function uploadFile(file, folder) {
    const filePath = `${folder}/${Date.now()}_${file.name}`;
    const { error } = await supabase.storage.from('media').upload(filePath, file);
    if (error) throw error;
    const { data } = supabase.storage.from('media').getPublicUrl(filePath);
    return data.publicUrl;
}

async function uploadMultipleFiles(files, folder) {
    return Promise.all(Array.from(files).map(file => uploadFile(file, folder)));
}

function handleSaveResponse(error) {
    if (error) {
        console.error("Save failed:", error);
        alert(`Error: ${error.message}`);
    } else {
        alert('Data saved successfully!');
    }
}
async function logout() {
    const { error } = await supabase.auth.signOut();
    if (error) {
        console.error('Error logging out:', error);
    } else {
        // Redirect to login page after successful sign out
        window.location.href = 'admin_login.html';
    }
}