"use strict";

// ============ Forgot Password Form ============
const forgotForm = document.getElementById('forgotPasswordForm');
if (forgotForm) {
    const emailInput = document.getElementById('resetEmail');
    const errorMsg = document.getElementById('formError');
    const successMsg = document.getElementById('formSuccess');
    const emailError = document.getElementById('emailError');
    const submitBtn = document.getElementById('submitBtn');
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    forgotForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Clear previous messages
        errorMsg.classList.add('hide');
        successMsg.classList.add('hide');
        emailError.classList.add('hide');

        const email = emailInput.value.trim();

        // Validate email
        if (!email) {
            emailError.textContent = '📧 Please enter your email address.';
            emailError.classList.remove('hide');
            return;
        }
        if (!emailPattern.test(email)) {
            emailError.textContent = '❗ Please enter a valid email address.';
            emailError.classList.remove('hide');
            return;
        }

        // Disable button while sending
        submitBtn.disabled = true;
        submitBtn.textContent = 'Sending...';

        try {
            const response = await fetch('/loginOrRegister/forgot_password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });

            const data = await response.json();

            if (response.ok && data.result === 'success') {
                successMsg.textContent = '✅ ' + data.message;
                successMsg.classList.remove('hide');
                emailInput.value = '';
            } else {
                errorMsg.textContent = '❌ ' + (data.message || 'Something went wrong.');
                errorMsg.classList.remove('hide');
            }
        } catch (err) {
            console.error('Forgot password error:', err);
            errorMsg.textContent = '❌ Network error. Please try again.';
            errorMsg.classList.remove('hide');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Send Reset Link';
        }
    });
}


// ============ Reset Password Form ============
const resetForm = document.getElementById('resetPasswordForm');
if (resetForm) {
    const newPasswordInput = document.getElementById('newPassword');
    const confirmPasswordInput = document.getElementById('confirmPassword');
    const tokenInput = document.getElementById('resetToken');
    const errorMsg = document.getElementById('formError');
    const successMsg = document.getElementById('formSuccess');
    const passwordError = document.getElementById('passwordError');
    const confirmPasswordError = document.getElementById('confirmPasswordError');
    const submitBtn = document.getElementById('submitBtn');
    const strongPasswordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&?*]).{8,}$/;

    // Password visibility toggle
    const pwToggle = document.getElementById('newPwToggle');
    if (pwToggle) {
        pwToggle.addEventListener('click', () => {
            const isHidden = newPasswordInput.type === 'password';
            newPasswordInput.type = isHidden ? 'text' : 'password';
            pwToggle.src = isHidden ? '/Assets/pwVisible.png' : '/Assets/pwInvisible.png';
        });
    }

    resetForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Clear previous messages
        errorMsg.classList.add('hide');
        successMsg.classList.add('hide');
        passwordError.classList.add('hide');
        confirmPasswordError.classList.add('hide');

        const newPassword = newPasswordInput.value;
        const confirmPassword = confirmPasswordInput.value;
        const token = tokenInput.value;

        // Validate
        let isValid = true;

        if (!newPassword) {
            passwordError.textContent = '🔐 Please enter a new password.';
            passwordError.classList.remove('hide');
            isValid = false;
        } else if (!strongPasswordPattern.test(newPassword)) {
            passwordError.textContent = '⚠️ Password must be at least 8 characters, including uppercase, lowercase, a number, and a symbol (!@#$%^&?*).';
            passwordError.classList.remove('hide');
            isValid = false;
        }

        if (!confirmPassword) {
            confirmPasswordError.textContent = '🔄 Please confirm your new password.';
            confirmPasswordError.classList.remove('hide');
            isValid = false;
        } else if (newPassword !== confirmPassword) {
            confirmPasswordError.textContent = '❌ Passwords do not match.';
            confirmPasswordError.classList.remove('hide');
            isValid = false;
        }

        if (!isValid) return;

        // Disable button while processing
        submitBtn.disabled = true;
        submitBtn.textContent = 'Resetting...';

        try {
            const response = await fetch('/loginOrRegister/reset_password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, newPassword }),
            });

            const data = await response.json();

            if (response.ok && data.result === 'success') {
                successMsg.textContent = '✅ ' + data.message + ' Redirecting to login...';
                successMsg.classList.remove('hide');

                // Redirect to login after 2 seconds
                setTimeout(() => {
                    window.location.href = '/loginOrRegister';
                }, 2000);
            } else {
                errorMsg.textContent = '❌ ' + (data.message || 'Something went wrong.');
                errorMsg.classList.remove('hide');
            }
        } catch (err) {
            console.error('Reset password error:', err);
            errorMsg.textContent = '❌ Network error. Please try again.';
            errorMsg.classList.remove('hide');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Reset Password';
        }
    });
}
