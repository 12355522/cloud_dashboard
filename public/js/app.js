// 畜牧業管理系統 JavaScript

document.addEventListener('DOMContentLoaded', function() {
    // 初始化工具提示
    var tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    var tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });

    // 場域卡片點擊效果
    const farmCards = document.querySelectorAll('.farm-card');
    farmCards.forEach(card => {
        card.addEventListener('click', function(e) {
            // 避免點擊下拉選單時觸發
            if (!e.target.closest('.dropdown')) {
                const farmId = this.dataset.farmId;
                if (farmId) {
                    window.location.href = `/farms/${farmId}`;
                }
            }
        });
    });

    // 表單驗證
    const forms = document.querySelectorAll('.needs-validation');
    forms.forEach(form => {
        form.addEventListener('submit', function(e) {
            if (!form.checkValidity()) {
                e.preventDefault();
                e.stopPropagation();
            }
            form.classList.add('was-validated');
        });
    });

    // IP 位址格式驗證
    const ipInputs = document.querySelectorAll('input[name="ip"]');
    ipInputs.forEach(input => {
        input.addEventListener('blur', function() {
            const value = this.value;
            const ipPattern = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
            
            if (value && !ipPattern.test(value)) {
                this.classList.add('is-invalid');
                let feedback = this.parentNode.querySelector('.invalid-feedback');
                if (!feedback) {
                    feedback = document.createElement('div');
                    feedback.className = 'invalid-feedback';
                    this.parentNode.appendChild(feedback);
                }
                feedback.textContent = '請輸入有效的 IP 位址格式';
            } else {
                this.classList.remove('is-invalid');
            }
        });
    });

    // 檔案上傳預覽
    const fileInputs = document.querySelectorAll('input[type="file"]');
    fileInputs.forEach(input => {
        input.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file && file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    // 創建預覽圖片
                    let preview = document.getElementById('image-preview');
                    if (!preview) {
                        preview = document.createElement('img');
                        preview.id = 'image-preview';
                        preview.className = 'img-fluid mt-2 image-preview';
                        preview.style.maxHeight = '200px';
                        input.parentNode.appendChild(preview);
                    }
                    preview.src = e.target.result;
                };
                reader.readAsDataURL(file);
            }
        });
    });

    // 數字輸入欄位驗證
    const numberInputs = document.querySelectorAll('input[type="number"]');
    numberInputs.forEach(input => {
        input.addEventListener('input', function() {
            const value = parseInt(this.value);
            const min = parseInt(this.min) || 0;
            const max = parseInt(this.max) || Infinity;
            
            if (isNaN(value) || value < min || value > max) {
                this.classList.add('is-invalid');
            } else {
                this.classList.remove('is-invalid');
            }
        });
    });

    // 搜尋功能
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            const searchTerm = this.value.toLowerCase();
            const farmCards = document.querySelectorAll('.farm-card');
            
            farmCards.forEach(card => {
                const farmName = card.querySelector('.card-header h5').textContent.toLowerCase();
                const farmIp = card.querySelector('code').textContent.toLowerCase();
                
                if (farmName.includes(searchTerm) || farmIp.includes(searchTerm)) {
                    card.closest('.col-lg-4').style.display = 'block';
                } else {
                    card.closest('.col-lg-4').style.display = 'none';
                }
            });
        });
    }

    // 自動重新整理統計資料
    const isDashboard = window.location.pathname === '/';
    if (isDashboard) {
        setInterval(function() {
            // 可以在這裡加入 AJAX 呼叫來更新統計資料
            // 目前先跳過，避免頻繁重新整理
        }, 30000); // 每30秒
    }

    // 確認刪除對話框
    const deleteButtons = document.querySelectorAll('.btn-delete');
    deleteButtons.forEach(button => {
        button.addEventListener('click', function(e) {
            e.preventDefault();
            const itemName = this.dataset.itemName || '此項目';
            if (confirm(`確定要刪除 ${itemName} 嗎？此操作無法復原。`)) {
                // 執行刪除操作
                window.location.href = this.href;
            }
        });
    });

    // 載入狀態指示器
    const submitButtons = document.querySelectorAll('button[type="submit"]');
    submitButtons.forEach(button => {
        button.addEventListener('click', function() {
            const form = this.closest('form');
            if (form && form.checkValidity()) {
                this.disabled = true;
                this.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>處理中...';
                
                // 5秒後恢復按鈕狀態（防止卡住）
                setTimeout(() => {
                    this.disabled = false;
                    this.innerHTML = this.dataset.originalText || '提交';
                }, 5000);
            }
        });
        
        // 儲存原始文字
        button.dataset.originalText = button.innerHTML;
    });

    // 側邊欄導航高亮
    const currentPath = window.location.pathname;
    const navLinks = document.querySelectorAll('.navbar-nav .nav-link');
    navLinks.forEach(link => {
        if (link.getAttribute('href') === currentPath) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });

    // 響應式表格
    const tables = document.querySelectorAll('.table');
    tables.forEach(table => {
        if (!table.closest('.table-responsive')) {
            const wrapper = document.createElement('div');
            wrapper.className = 'table-responsive';
            table.parentNode.insertBefore(wrapper, table);
            wrapper.appendChild(table);
        }
    });

    // 統計卡片動畫
    const statCards = document.querySelectorAll('.card');
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, observerOptions);

    statCards.forEach(card => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(20px)';
        card.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(card);
    });
});

// 全域函式

// 顯示通知訊息
function showNotification(message, type = 'info') {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show position-fixed`;
    alertDiv.style.top = '20px';
    alertDiv.style.right = '20px';
    alertDiv.style.zIndex = '9999';
    alertDiv.style.minWidth = '300px';
    
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    document.body.appendChild(alertDiv);
    
    // 5秒後自動移除
    setTimeout(() => {
        if (alertDiv.parentNode) {
            alertDiv.remove();
        }
    }, 5000);
}

// 格式化數字
function formatNumber(num) {
    return new Intl.NumberFormat('zh-TW').format(num);
}

// 複製到剪貼簿
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(function() {
        showNotification('已複製到剪貼簿', 'success');
    }, function(err) {
        console.error('複製失敗: ', err);
        showNotification('複製失敗', 'danger');
    });
}

// 時間格式化
function formatDate(date) {
    return new Intl.DateTimeFormat('zh-TW', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    }).format(new Date(date));
}

// AJAX 請求封裝
function makeRequest(url, options = {}) {
    const defaultOptions = {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json'
        }
    };
    
    return fetch(url, { ...defaultOptions, ...options })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .catch(error => {
            console.error('Request failed:', error);
            showNotification('請求失敗，請檢查網路連線', 'danger');
            throw error;
        });
}

// 載入狀態管理
function showLoading(element) {
    if (!element) {
        console.warn('showLoading: element 參數為空');
        return;
    }
    
    if (element.classList) {
        element.classList.add('loading');
    }
    
    if (element.style) {
        element.style.pointerEvents = 'none';
    }
}

function hideLoading(element) {
    if (!element) {
        console.warn('hideLoading: element 參數為空');
        return;
    }
    
    if (element.classList) {
        element.classList.remove('loading');
    }
    
    if (element.style) {
        element.style.pointerEvents = 'auto';
    }
}

// 表單重置
function resetForm(formId) {
    const form = document.getElementById(formId);
    if (form) {
        form.reset();
        form.classList.remove('was-validated');
        
        // 清除所有錯誤狀態
        const invalidInputs = form.querySelectorAll('.is-invalid');
        invalidInputs.forEach(input => input.classList.remove('is-invalid'));
    }
}
