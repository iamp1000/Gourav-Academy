// This is the combined script for all frontend logic, including animations and data fetching.

// AFTER
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey)

document.addEventListener('DOMContentLoaded', () => {
    initializePageData();
});

function initializeAnimations() {
    gsap.registerPlugin(ScrollTrigger);

    const lenis = new Lenis({
        duration: 1.2,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    });
    function raf(time) {
        lenis.raf(time);
        requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => {
        lenis.raf(time * 1000);
    });
    gsap.ticker.lagSmoothing(0);

    const header = document.querySelector('#navbar-header');
    if (header) {
        const showAnim = gsap.from(header, {
            yPercent: -100, paused: true, duration: 0.4, ease: 'power2.inOut'
        }).progress(1);
        ScrollTrigger.create({
            start: "top top", end: 99999,
            onUpdate: (self) => self.direction === 1 ? showAnim.reverse() : showAnim.play()
        });
    }

    let ctx = gsap.context(() => {
        // Only run hero animation if the unique `.homepage-hero` class exists.
        if (document.querySelector('.homepage-hero')) {
            gsap.timeline({ defaults: { duration: 1, ease: "power3.out" } })
                .from('.hero-heading > *', { autoAlpha: 0, y: 50, stagger: 0.2 }, 0.5)
                .from('.hero-content p', { autoAlpha: 0, y: 30 }, "-=0.6")
                .from('.hero-ctas a', { autoAlpha: 0, scale: 0.9, stagger: 0.15 }, "-=0.5");
        }

        gsap.utils.toArray('.anim-stagger-children').forEach(container => {
            // Check if container has children before creating animation
            if (container.children.length > 0) {
                gsap.from(container.children, {
                    autoAlpha: 0, y: 75, stagger: 0.2, duration: 1, ease: 'power3.out',
                    scrollTrigger: { trigger: container, start: 'top 85%', toggleActions: 'play none none reset' }
                });
            }
        });

        gsap.utils.toArray('.anim-fade-up').forEach(elem => {
            gsap.from(elem, {
                autoAlpha: 0, y: 75, duration: 1, ease: 'power3.out',
                scrollTrigger: { trigger: elem, start: 'top 90%', toggleActions: 'play none none reset' }
            });
        });

        gsap.utils.toArray('.timeline-item').forEach((item, index) => {
            const direction = index % 2 === 0 ? -50 : 50;
            gsap.from(item, {
                autoAlpha: 0, x: direction, duration: 1, ease: 'power3.out',
                scrollTrigger: { trigger: item, start: 'top 85%', toggleActions: 'play none none reset' }
            });
        });
    });

    window.addEventListener('beforeunload', () => ctx.revert());
}

async function initializePageData() {
    try {
        const [contactRes, pricingRes, coachRes, heroRes, scheduleRes, galleryRes] = await Promise.all([
            supabase.from('contact').select('*').limit(1).single(),
            supabase.from('pricing').select('*').limit(1).single(),
            supabase.from('coach').select('*').limit(1).single(),
            supabase.from('hero_media').select('*').order('display_order'),
            supabase.from('schedule').select('*').order('display_order'),
            supabase.from('gallery').select('*').order('display_order', { ascending: true })
        ]);

        const allData = {
            contact: contactRes.data || {}, pricing: pricingRes.data || {},
            coach: coachRes.data || {}, hero_media: heroRes.data || [],
            schedule: scheduleRes.data || [], gallery: galleryRes.data || [],
        };

        renderAllData(allData);
        initializeAnimations();

    } catch (e) {
        console.error("Error initializing page data:", e);
        initializeAnimations();
    }
    setupContactForm();
}

function renderAllData(data) {
    if (data.contact) {
        renderContactInfo(data.contact);
        renderFooterContactInfo(data.contact);
    }
    if (data.pricing) renderPricing(data.pricing);
    if (data.coach) renderCoachImage(data.coach);
    if (data.hero_media) renderHeroCarousel(data.hero_media);
    if (data.schedule) renderSchedule(data.schedule);
    if (data.gallery) renderGallery(data.gallery);
}

function renderGallery(galleryItems) {
    const victoriesContainer = document.getElementById('gallery-victories');
    const trainingContainer = document.getElementById('gallery-training');
    const testimonialsContainer = document.getElementById('gallery-testimonials');

    // This check ensures this code only runs on the gallery page
    if (!victoriesContainer && !trainingContainer && !testimonialsContainer) {
        return;
    }

    const victories = galleryItems.filter(item => item.category === 'victories');
    const training = galleryItems.filter(item => item.category === 'training');
    const testimonials = galleryItems.filter(item => item.category === 'testimonials');

    // --- Section 1: Tournament Victories (No change here) ---
    if (victoriesContainer) {
        if (victories.length > 0) {
            victoriesContainer.innerHTML = victories.map(item => `
                <div class="card-item group">
                    <div class="relative overflow-hidden rounded-2xl shadow-2xl">
                        <img src="${item.image_url}" alt="${item.title || 'Tournament Victory'}" class="w-full h-80 object-cover transform group-hover:scale-105 transition-transform duration-300">
                        <div class="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent"></div>
                        <div class="absolute bottom-0 left-0 p-6">
                            <h3 class="text-2xl font-bold font-display">${item.title || 'Victory'}</h3>
                            <p class="text-color-quaternary">${item.description || ''}</p>
                        </div>
                    </div>
                </div>`).join('');
        } else {
            victoriesContainer.innerHTML = `<p class="col-span-full text-center py-10 text-white/50">No victory images uploaded yet.</p>`;
        }
    }

    // --- Section 2: Life at the Academy (THIS IS THE FIX) ---
    if (trainingContainer) {
        if (training.length > 0) {
            // Define size classes for variety in the layout
            const sizeClasses = ['masonry-large', 'masonry-medium', 'masonry-medium', 'masonry-small', 'masonry-medium'];

            trainingContainer.innerHTML = training.map((item, index) => {
                // Cycle through the size classes to create a dynamic look
                const sizeClass = sizeClasses[index % sizeClasses.length];

                return `
                    <div class="masonry-item ${sizeClass}" style="background-image: linear-gradient(rgba(26, 26, 26, 0.4), rgba(26, 26, 26, 0.6)), url('${item.image_url}');">
                        <div class="masonry-content">
                            <h3 class="masonry-title">${item.title || 'Academy Life'}</h3>
                        </div>
                    </div>
                `;
            }).join('');
        } else {
            // Keep the original placeholder text
            trainingContainer.innerHTML = `
                <div class="masonry-item masonry-large" style="background-image: linear-gradient(rgba(26, 26, 26, 0.4), rgba(26, 26, 26, 0.6)), url('https://placehold.co/600x600/5585b5/ffffff?text=Drills');"><div class="masonry-content"><h3 class="masonry-title">Drills</h3></div></div>
                <div class="masonry-item masonry-medium" style="background-image: linear-gradient(rgba(26, 26, 26, 0.4), rgba(26, 26, 26, 0.6)), url('https://placehold.co/400x300/53a8b6/ffffff?text=Fitness');"><div class="masonry-content"><h3 class="masonry-title">Fitness</h3></div></div>
                <p class="col-span-full text-center py-10 text-white/50">No training images uploaded yet.</p>
            `;
        }
    }

    // --- Section 3: Testimonials (No change here) ---
    if (testimonialsContainer) {
        if (testimonials.length > 0) {
            testimonialsContainer.innerHTML = testimonials.map(item => `
                <div class="card-item bg-color-primary/20 p-8 rounded-2xl border border-color-secondary/30 flex flex-col items-center text-center">
                    <img class="w-24 h-24 mb-4 rounded-full object-cover" src="${item.image_url}" alt="Photo of ${item.title || 'a player'}">
                    <p class="italic text-color-quaternary mb-4">"${item.description || ''}"</p>
                    <div class="mt-auto">
                        <h4 class="font-bold text-xl text-white">${item.title || 'Player'}</h4>
                        <p class="text-color-tertiary">GBA Student</p>
                    </div>
                </div>`).join('');
        } else {
            testimonialsContainer.innerHTML = `<p class="col-span-full text-center py-10 text-white/50">No testimonials uploaded yet.</p>`;
        }
    }
}

function renderHeroCarousel(mediaItems) {
    const carouselContainer = document.getElementById('hero-carousel');
    if (!carouselContainer) return;
    carouselContainer.innerHTML = '';
    if (mediaItems && mediaItems.length > 0) {
        mediaItems.forEach((item, index) => {
            let element;
            if (item.media_type === 'video') {
                element = document.createElement('video');
                element.src = item.url;
                element.className = 'absolute inset-0 w-full h-full object-cover transition-opacity duration-1000';
                element.autoplay = true; element.loop = true; element.muted = true; element.playsInline = true;
            } else {
                element = document.createElement('div');
                element.className = 'absolute inset-0 w-full h-full bg-cover bg-center transition-opacity duration-1000';
                element.style.backgroundImage = `url('${item.url}')`;
            }
            element.style.opacity = index === 0 ? '1' : '0';
            carouselContainer.appendChild(element);
        });
        if (mediaItems.length > 1) {
            let currentIndex = 0;
            const elements = Array.from(carouselContainer.children);
            setInterval(() => {
                elements[currentIndex].style.opacity = '0';
                currentIndex = (currentIndex + 1) % elements.length;
                elements[currentIndex].style.opacity = '1';
            }, 5000);
        }
    } else {
        carouselContainer.innerHTML = `<div class="absolute inset-0 bg-cover bg-center" style="background-image: url('https://placehold.co/1920x1080/1a1a1a/5585b5?text=Gourav+Badminton+Academy');"></div>`;
    }
}

function renderCoachImage(coach) {
    const imgElement = document.getElementById('coach-image');
    if (imgElement && coach?.image_url) {
        imgElement.src = coach.image_url;
        imgElement.alt = "Head Coach Gourav Kumar";
    }
}

function renderPricing(pricing) {
    const container = document.getElementById('programs-container');
    if (!container) return;
    const programs = [
        { level: 'Beginner', price: pricing?.beginner, icon: 'fa-child', description: 'Fundamental skills, rules, and footwork.' },
        { level: 'Intermediate', price: pricing?.intermediate, icon: 'fa-person-running', description: 'Advanced techniques and strategy.' },
        { level: 'Advanced', price: pricing?.advanced, icon: 'fa-trophy', description: 'Elite-level training for champions.' }
    ];
    container.innerHTML = programs.map(p => `<div class="card-item bg-color-primary/10 border border-color-secondary/30 p-8 rounded-2xl shadow-lg flex flex-col"><div class="text-5xl text-color-tertiary mb-4"><i class="fas ${p.icon}"></i></div><h3 class="text-3xl font-display font-bold text-white mb-2">${p.level} Program</h3><p class="text-white/70 mb-4 flex-grow">${p.description}</p><div class="mt-auto"><p class="text-4xl font-display font-black text-color-tertiary">₹${p.price || "N/A"}<span class="text-lg font-body text-white/60">/month</span></p><a href="contact.html" class="cta-button bg-color-secondary text-white hover:bg-color-tertiary mt-6 inline-block">Enroll Now</a></div></div>`).join("")
}

function renderSchedule(scheduleItems) {
    const tableBody = document.getElementById('schedule-body');
    if (!tableBody) return;
    if (scheduleItems && scheduleItems.length > 0) {
        tableBody.innerHTML = scheduleItems.map(item => `<tr class="hover:bg-color-secondary/10 transition-colors duration-300"><td class="p-4 font-semibold">${item.day}</td><td class="p-4">${item.time}</td><td class="p-4"><span class="schedule-tag bg-color-secondary text-color-dark">${item.program}</span></td><td class="p-4">${item.coach_name}</td></tr>`).join("")
    } else {
        tableBody.innerHTML = `<tr><td colspan="4" class="text-center p-8">Schedule coming soon...</td></tr>`
    }
}

function renderContactInfo(contact) {
    const container = document.getElementById('contact-info-box'), whatsappFloat = document.getElementById('whatsapp-float');
    if (container) {
        container.innerHTML = `
            <h4 class="text-3xl font-display font-bold mb-6 text-color-tertiary">Contact Information</h4>
            <div class="space-y-4 text-white/90">
                <p><i class="fas fa-phone mr-3 text-color-secondary"></i> ${contact?.phone || "N/A"}</p>
                <p><i class="fas fa-envelope mr-3 text-color-secondary"></i> ${contact?.email || "N/A"}</p>
                <p><i class="fas fa-map-marker-alt mr-3 text-color-secondary"></i> ${contact?.address || "N/A"}</p>
                <p><i class="fab fa-whatsapp mr-3 text-color-secondary"></i> ${contact?.whatsapp || "N/A"}</p>
            </div>`
    } if (whatsappFloat && contact?.whatsapp) { whatsappFloat.href = `https://wa.me/${contact.whatsapp.replace(/\D/g, "")}` }
}

function renderFooterContactInfo(contact) {
    const container = document.getElementById('footer-contact-info');
    if (container) {
        container.innerHTML = `
            <h5 class="text-lg font-semibold mb-4 text-color-secondary">Contact Info</h5>
            <ul class="text-gray-400 space-y-2 text-sm">
                <li><i class="fas fa-phone mr-2"></i> ${contact?.phone || ""}</li>
                <li><i class="fas fa-envelope mr-2"></i> ${contact?.email || ""}</li>
                <li><i class="fas fa-map-marker-alt mr-2"></i> ${contact?.address || ""}</li>
            </ul>`
    }
}

function setupContactForm() {
    const form = document.getElementById('contactForm');
    if (!form) return;
    form.addEventListener('submit', async e => {
        e.preventDefault();
        const name = document.getElementById('name').value, phone = document.getElementById('phone').value, program = document.getElementById('program').value, message = document.getElementById('message').value;
        const { data, error } = await supabase.from('contact').select('whatsapp').limit(1).single();
        if (error || !data?.whatsapp) { console.error("Could not fetch WhatsApp number:", error); alert("Sorry, the contact form is temporarily unavailable."); return }
        const whatsappNumber = data.whatsapp.replace(/\D/g, ""), fullMessage = `Hello, I'm ${name}.\n\n*Phone:* ${phone}\n*Program of Interest:* ${program}\n\n*Message:*\n${message}`, encodedMessage = encodeURIComponent(fullMessage), whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodedMessage}`; window.open(whatsappUrl, "_blank")
    })
}