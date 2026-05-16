// Eligibility Form JavaScript - Shared Template
// This template uses {{loc_name}} as a placeholder that gets replaced by Python

let currentStep = 1;
const totalSteps = 5;
const formData = {};
const leadsApiEndpoint = '/api/public/leads';

function primeFormStartTime() {
    const form = document.getElementById('eligibility-form');
    if (form && !form.dataset.startedAt) {
        form.dataset.startedAt = Date.now().toString();
    }
}

function getSubmissionDuration() {
    const form = document.getElementById('eligibility-form');
    const startedAt = Number(form?.dataset?.startedAt || Date.now());
    return Math.max(0, Date.now() - startedAt);
}

function updateProgressBar() {
    const percent = Math.round((currentStep / 5) * 100);
    document.getElementById('eligibility-step-text').textContent = `Step ${currentStep} of 5`;
    document.getElementById('eligibility-percent-text').textContent = `${percent}% complete`;
    document.getElementById('eligibility-progress-bar').style.width = `${percent}%`;
}

function openEligibilityModal() {
    document.getElementById("eligibility-modal").classList.add("active");
    document.body.style.overflow = "hidden";
    currentStep = 1;
    showStep(1);
    updateProgressBar();
    primeFormStartTime();
}

function closeEligibilityModal() {
    document.getElementById("eligibility-modal").classList.remove("active");
    document.body.style.overflow = "";
    currentStep = 1;
    document.querySelectorAll(".selection-card").forEach(c => c.classList.remove("selected"));
    const form = document.getElementById("eligibility-form");
    form.reset();
    form.dataset.startedAt = Date.now().toString();
    showStep(1);
    updateProgressBar();
}

function showStep(s) {
    document.querySelectorAll(".step").forEach(e => e.classList.remove("active"));
    document.querySelector(`[data-step="${s}"]`).classList.add("active");
    document.getElementById("prev-btn").style.visibility = s === 1 ? "hidden" : "visible";
    
    if (s === 4) {
        document.getElementById("next-btn").innerHTML = 'Submit <i data-lucide="chevron-right" class="w-4 h-4"></i>';
    } else if (s === 5) {
        document.getElementById("form-nav").style.display = "none";
    } else {
        document.getElementById("next-btn").innerHTML = 'Next <i data-lucide="chevron-right" class="w-4 h-4"></i>';
        document.getElementById("form-nav").style.display = "flex";
    }
    lucide.createIcons();
    updateProgressBar();
}

function selectOption(e, f) {
    e.parentElement.querySelectorAll(".selection-card").forEach(c => c.classList.remove("selected"));
    e.classList.add("selected");
    formData[f] = e.dataset.value;
}

function nextStep() {
    if (currentStep === 1 && !formData.painLocation) {
        alert('Please select where your pain is located');
        return;
    }
    if (currentStep === 2 && !formData.insuranceType) {
        alert('Please select your insurance type');
        return;
    }
    if (currentStep === 3 && !formData.hasDoctor) {
        alert('Please select if you have a doctor');
        return;
    }
    
    if (currentStep < 4) {
        currentStep++;
        showStep(currentStep);
    } else if (currentStep === 4) {
        const form = document.getElementById("eligibility-form");
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }
        const fd = new FormData(form);
        fd.forEach((v, k) => formData[k] = v);
        formData.location = "{{loc_name}}";
        formData.form_source = "eligibility_check";
        submitEligibilityForm();
        currentStep = 5;
        showStep(5);
    }
}

async function submitEligibilityForm() {
    try {
        const response = await fetch(leadsApiEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                firstName: formData.firstName,
                lastName: formData.lastName,
                phone: formData.phone,
                email: formData.email || '',
                zipCode: formData.zipCode,
                bestTime: formData.bestTime || 'morning',
                formType: 'eligibility_check',
                painLocation: formData.painLocation,
                insuranceType: formData.insuranceType,
                hasDoctor: formData.hasDoctor,
                message: `Location: {{loc_name}}`,
                consentContact: true,
                consentTcpa: true,
                consentLanguage: 'Consent to contact and TCPA consent accepted via shared eligibility form.',
                website: formData.website || '',
                submissionDuration: getSubmissionDuration()
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || 'Unable to submit eligibility form.');
        }
    } catch (e) {
        console.error('Error submitting form:', e);
        alert(e.message || 'Something went wrong. Please try again.');
    }
}

function prevStep() {
    if (currentStep > 1) {
        currentStep--;
        showStep(currentStep);
    }
}

// Close modal when clicking outside
document.getElementById("eligibility-modal")?.addEventListener("click", function(e) {
    if (e.target === this) closeEligibilityModal();
});

primeFormStartTime();
