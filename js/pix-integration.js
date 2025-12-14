/**
 * Shared PIX Integration Logic
 * Handles calling the API, displaying QR code, and verifying payment status.
 */

const PIX_CONFIG = {
    apiBaseUrl: '../../api/gateway.js', // Adjust relative path as needed
    pollInterval: 3000,
    checkLimit: 100 // Stop checking after 5 minutes roughly
};

class PixPayment {
    constructor(config) {
        this.config = { ...PIX_CONFIG, ...config };
        this.checkCount = 0;
        this.intervalId = null;
        this.isProcessing = false;
    }

    async startPayment(userData) {
        if (this.isProcessing) return;
        this.isProcessing = true;

        // Merge provided userData with any defaults or validated data
        let finalUserData = { ...userData };

        // Validate required fields
        if (!finalUserData.name || !finalUserData.cpf) {
            console.log("Missing user data, showing form...");
            this.showUserForm((collectedData) => {
                this.startPayment({ ...finalUserData, ...collectedData });
            });
            this.isProcessing = false; // Reset flag so re-entry works
            return;
        }

        this.showLoading();

        try {
            // 1. Create PIX
            const params = new URLSearchParams({
                acao: 'criar',
                nome: finalUserData.name,
                email: finalUserData.email || 'cliente@email.com',
                telefone: finalUserData.phone || '00000000000',
                cpf: finalUserData.cpf,
                valor: this.config.amount,
                oferta: this.config.offer || 'tiktok',
                up: this.config.upsellIndex || '',
                utm: window.location.search // Pass UTM parameters
            });

            const response = await fetch(`${this.config.apiBaseUrl}?${params.toString()}`, {
                method: 'POST'
            });
            const data = await response.json();

            if (data.payment_id) {
                this.showPixModal(data.pixCode, data.payment_id);
            } else {
                alert('Erro ao gerar PIX: ' + (data.erroMsg || 'Desconhecido'));
                this.isProcessing = false;
                this.hideLoading();
            }

        } catch (error) {
            console.error('Erro PIX:', error);
            alert('Erro ao conectar com o servidor de pagamento.');
            this.isProcessing = false;
            this.hideLoading();
        }
    }

    showUserForm(callback) {
        const modalId = 'user-data-modal';
        if (document.getElementById(modalId)) return; // Already showing

        const modal = document.createElement('div');
        modal.id = modalId;
        modal.style.cssText = `
            position: fixed; inset: 0; background: rgba(0,0,0,0.9); z-index: 10002;
            display: flex; align-items: center; justify-content: center; font-family: sans-serif;
        `;

        modal.innerHTML = `
            <div style="background: white; padding: 25px; border-radius: 15px; width: 90%; max-width: 400px; text-align: left; position: relative;">
                <h3 style="margin-bottom: 20px; color: #333; text-align: center;">Dados para Pagamento</h3>
                
                <label style="display:block; margin-bottom: 5px; font-size: 14px; color: #555;">Nome Completo</label>
                <input type="text" id="input-name" style="width: 100%; padding: 10px; margin-bottom: 15px; border: 1px solid #ccc; border-radius: 5px;" placeholder="Seu nome">

                <label style="display:block; margin-bottom: 5px; font-size: 14px; color: #555;">CPF</label>
                <input type="text" id="input-cpf" style="width: 100%; padding: 10px; margin-bottom: 15px; border: 1px solid #ccc; border-radius: 5px;" placeholder="000.000.000-00">

                <label style="display:block; margin-bottom: 5px; font-size: 14px; color: #555;">Telefone (Opcional)</label>
                <input type="text" id="input-phone" style="width: 100%; padding: 10px; margin-bottom: 20px; border: 1px solid #ccc; border-radius: 5px;" placeholder="(00) 00000-0000">

                <button id="submit-user-data" style="background: #FE2C55; color: white; border: none; padding: 12px 24px; border-radius: 25px; font-weight: bold; cursor: pointer; width: 100%;">
                    CONTINUAR
                </button>
            </div>
        `;

        document.body.appendChild(modal);

        document.getElementById('submit-user-data').onclick = () => {
            const name = document.getElementById('input-name').value;
            const cpf = document.getElementById('input-cpf').value;
            const phone = document.getElementById('input-phone').value;

            if (!name || !cpf) {
                alert('Por favor, preencha Nome e CPF.');
                return;
            }

            document.getElementById(modalId).remove();
            callback({ name, cpf, phone });
        };
    }


    showLoading() {
        // Implement simple overlay loader or use existing one
        const loader = document.createElement('div');
        loader.id = 'pix-loader';
        loader.style.cssText = `
            position: fixed; inset: 0; background: rgba(0,0,0,0.8); z-index: 10000;
            display: flex; flex-direction: column; align-items: center; justify-content: center; color: white;
        `;
        loader.innerHTML = '<div class="spinner" style="border: 4px solid #f3f3f3; border-top: 4px solid #FE2C55; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite;"></div><p style="margin-top: 10px;">Gerando Pagamento...</p><style>@keyframes spin {0% {transform: rotate(0deg);} 100% {transform: rotate(360deg);}}</style>';
        document.body.appendChild(loader);
    }

    hideLoading() {
        const loader = document.getElementById('pix-loader');
        if (loader) loader.remove();
    }

    showPixModal(pixCode, paymentId) {
        this.hideLoading();

        // Remove existing modal if any
        const existing = document.getElementById('pix-modal-overlay');
        if (existing) existing.remove();

        const modal = document.createElement('div');
        modal.id = 'pix-modal-overlay';
        modal.style.cssText = `
            position: fixed; inset: 0; background: rgba(0,0,0,0.9); z-index: 10001;
            display: flex; align-items: center; justify-content: center; font-family: sans-serif;
        `;

        modal.innerHTML = `
            <div style="background: white; padding: 25px; border-radius: 15px; width: 90%; max-width: 400px; text-align: center; position: relative;">
                <button onclick="document.getElementById('pix-modal-overlay').remove()" style="position: absolute; top: 10px; right: 15px; background: none; border: none; font-size: 24px; cursor: pointer;">&times;</button>
                <h3 style="margin-bottom: 20px; color: #333;">Pague via PIX</h3>
                <p style="color: #666; font-size: 14px; margin-bottom: 15px;">Copie o código abaixo e pague no app do seu banco:</p>
                
                <div style="background: #f5f5f5; padding: 10px; border-radius: 5px; margin-bottom: 15px; word-break: break-all; border: 1px dashed #ccc; font-family: monospace; font-size: 12px; max-height: 100px; overflow-y: auto;">
                    ${pixCode}
                </div>

                <button id="copy-pix-btn" style="background: #FE2C55; color: white; border: none; padding: 12px 24px; border-radius: 25px; font-weight: bold; cursor: pointer; width: 100%; margin-bottom: 15px;">
                    COPIAR CÓDIGO PIX
                </button>

                <div id="pix-status" style="font-size: 14px; color: #888; display: flex; align-items: center; justify-content: center; gap: 5px;">
                    <div style="width: 10px; height: 10px; background: #ccc; border-radius: 50%;" id="status-dot"></div>
                    Aguardando pagamento...
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Copy functionality
        document.getElementById('copy-pix-btn').onclick = () => {
            navigator.clipboard.writeText(pixCode).then(() => {
                const btn = document.getElementById('copy-pix-btn');
                const originalText = btn.innerText;
                btn.innerText = 'Copiado!';
                setTimeout(() => btn.innerText = originalText, 2000);
            });
        };

        // Start polling
        this.startPolling(paymentId);
    }

    startPolling(paymentId) {
        if (this.intervalId) clearInterval(this.intervalId);
        this.checkCount = 0;

        const statusDot = document.getElementById('status-dot');
        const statusText = document.getElementById('pix-status');

        this.intervalId = setInterval(async () => {
            if (this.checkCount >= this.config.checkLimit) {
                clearInterval(this.intervalId);
                return;
            }
            this.checkCount++;

            try {
                // Blink effect
                if (statusDot) statusDot.style.background = this.checkCount % 2 === 0 ? '#FE2C55' : '#ccc';

                const response = await fetch(`${this.config.apiBaseUrl}?acao=verificar&payment_id=${paymentId}`);
                const data = await response.json();

                if (data.status === 'approved' || data.status === 'paid') {
                    clearInterval(this.intervalId);
                    if (statusText) statusText.innerHTML = '<span style="color: green; font-weight: bold;">Pago com sucesso!</span>';

                    setTimeout(() => {
                        window.location.href = this.config.nextPage;
                    }, 1500);
                }
            } catch (e) {
                console.error('Check error', e);
            }

        }, this.config.pollInterval);
    }
}

// Helper to init from window
window.initPixPayment = function (config, userData) {
    const payment = new PixPayment(config);
    payment.startPayment(userData);
};
