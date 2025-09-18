// Contract Configuration - UPDATE THESE VALUES
const CONTRACT_ADDRESS = "0x..."; // Your contract address here
const CONTRACT_ABI = [
    // Your contract ABI here - example ABI for ERC20-like contract
    "function name() view returns (string)",
    "function symbol() view returns (string)", 
    "function totalSupply() view returns (uint256)",
    "function balanceOf(address) view returns (uint256)",
    "function transfer(address to, uint256 amount) returns (bool)",
    "function approve(address spender, uint256 amount) returns (bool)",
    // Add more functions as needed
];

// Global variables
let provider = null;
let signer = null;
let contract = null;
let userAccount = null;

// DOM elements
const connectWalletBtn = document.getElementById('connectWallet');
const walletInfo = document.getElementById('walletInfo');
const walletAddress = document.getElementById('walletAddress');
const walletBalance = document.getElementById('walletBalance');
const contractAddress = document.getElementById('contractAddress');
const networkName = document.getElementById('networkName');
const contractStatus = document.getElementById('contractStatus');
const readFunctionSelect = document.getElementById('readFunctionSelect');
const readParams = document.getElementById('readParams');
const readFunctionBtn = document.getElementById('readFunction');
const readResult = document.getElementById('readResult');
const writeFunctionSelect = document.getElementById('writeFunctionSelect');
const writeParams = document.getElementById('writeParams');
const ethValue = document.getElementById('ethValue');
const writeFunctionBtn = document.getElementById('writeFunction');
const writeResult = document.getElementById('writeResult');
const transactionHistory = document.getElementById('transactionHistory');
const loadingModal = document.getElementById('loadingModal');

// Initialize app
document.addEventListener('DOMContentLoaded', async () => {
    console.log('App initialized');
    setupEventListeners();
    await checkWalletConnection();
});

// Setup event listeners
function setupEventListeners() {
    connectWalletBtn.addEventListener('click', connectWallet);
    readFunctionBtn.addEventListener('click', executeReadFunction);
    writeFunctionBtn.addEventListener('click', executeWriteFunction);
    
    // Auto-update parameter placeholder based on selected function
    readFunctionSelect.addEventListener('change', updateReadParamsPlaceholder);
    writeFunctionSelect.addEventListener('change', updateWriteParamsPlaceholder);
}

// Check if wallet is already connected
async function checkWalletConnection() {
    if (typeof window.ethereum !== 'undefined') {
        try {
            const accounts = await window.ethereum.request({ method: 'eth_accounts' });
            if (accounts.length > 0) {
                await connectWallet();
            }
        } catch (error) {
            console.error('Error checking wallet connection:', error);
        }
    }
}

// Connect wallet function
async function connectWallet() {
    try {
        if (typeof window.ethereum === 'undefined') {
            alert('Please install MetaMask or another Ethereum wallet');
            return;
        }

        // Request account access
        const accounts = await window.ethereum.request({ 
            method: 'eth_requestAccounts' 
        });
        
        if (accounts.length === 0) {
            throw new Error('No accounts found');
        }

        // Initialize ethers provider and signer
        provider = new ethers.providers.Web3Provider(window.ethereum);
        signer = provider.getSigner();
        userAccount = accounts[0];

        // Initialize contract
        if (CONTRACT_ADDRESS && CONTRACT_ABI.length > 0) {
            contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
        }

        // Update UI
        await updateWalletUI();
        await updateContractUI();

        console.log('Wallet connected:', userAccount);

        // Listen for account changes
        window.ethereum.on('accountsChanged', handleAccountsChanged);
        window.ethereum.on('chainChanged', handleChainChanged);

    } catch (error) {
        console.error('Error connecting wallet:', error);
        showError(writeResult, `Failed to connect wallet: ${error.message}`);
    }
}

// Handle account changes
async function handleAccountsChanged(accounts) {
    if (accounts.length === 0) {
        disconnectWallet();
    } else {
        userAccount = accounts[0];
        signer = provider.getSigner();
        if (contract) {
            contract = contract.connect(signer);
        }
        await updateWalletUI();
    }
}

// Handle chain changes
function handleChainChanged(chainId) {
    window.location.reload();
}

// Disconnect wallet
function disconnectWallet() {
    provider = null;
    signer = null;
    contract = null;
    userAccount = null;
    
    connectWalletBtn.textContent = 'Connect Wallet';
    walletInfo.classList.add('hidden');
    contractStatus.textContent = 'Disconnected';
    contractAddress.textContent = 'Not connected';
    networkName.textContent = 'Not connected';
}

// Update wallet UI
async function updateWalletUI() {
    if (!provider || !userAccount) return;

    try {
        // Get balance
        const balance = await provider.getBalance(userAccount);
        const balanceInEth = ethers.utils.formatEther(balance);

        // Update UI elements
        walletAddress.textContent = `${userAccount.slice(0, 6)}...${userAccount.slice(-4)}`;
        walletBalance.textContent = `${parseFloat(balanceInEth).toFixed(4)} ETH`;
        
        connectWalletBtn.textContent = 'Connected';
        connectWalletBtn.disabled = true;
        walletInfo.classList.remove('hidden');

    } catch (error) {
        console.error('Error updating wallet UI:', error);
    }
}

// Update contract UI
async function updateContractUI() {
    if (!provider) return;

    try {
        const network = await provider.getNetwork();
        networkName.textContent = network.name || `Chain ID: ${network.chainId}`;
        
        if (contract) {
            contractAddress.textContent = `${CONTRACT_ADDRESS.slice(0, 6)}...${CONTRACT_ADDRESS.slice(-4)}`;
            contractStatus.textContent = 'Connected';
        } else {
            contractStatus.textContent = 'Contract not configured';
        }
    } catch (error) {
        console.error('Error updating contract UI:', error);
    }
}

// Update parameter placeholders
function updateReadParamsPlaceholder() {
    const selectedFunction = readFunctionSelect.value;
    const placeholders = {
        'balanceOf': 'Enter address (0x...)',
        'allowance': 'owner address, spender address',
        'getStakeInfo': 'Enter address (0x...)'
    };
    
    readParams.placeholder = placeholders[selectedFunction] || 'Enter parameters separated by comma';
}

function updateWriteParamsPlaceholder() {
    const selectedFunction = writeFunctionSelect.value;
    const placeholders = {
        'transfer': 'recipient address, amount',
        'approve': 'spender address, amount',
        'mint': 'recipient address, amount',
        'burn': 'amount',
        'stake': 'amount',
        'unstake': 'amount'
    };
    
    writeParams.placeholder = placeholders[selectedFunction] || 'Enter parameters separated by comma';
}

// Execute read function
async function executeReadFunction() {
    const functionName = readFunctionSelect.value;
    if (!functionName) {
        showError(readResult, 'Please select a function');
        return;
    }

    if (!contract) {
        showError(readResult, 'Contract not connected');
        return;
    }

    try {
        readFunctionBtn.disabled = true;
        clearResult(readResult);
        
        const params = parseParameters(readParams.value);
        console.log(`Calling ${functionName} with params:`, params);
        
        const result = await contract[functionName](...params);
        
        // Format result based on type
        let formattedResult;
        if (ethers.BigNumber.isBigNumber(result)) {
            formattedResult = result.toString();
        } else if (typeof result === 'object') {
            formattedResult = JSON.stringify(result, null, 2);
        } else {
            formattedResult = result.toString();
        }
        
        showSuccess(readResult, `Result: ${formattedResult}`);
        
    } catch (error) {
        console.error('Error executing read function:', error);
        showError(readResult, `Error: ${error.message}`);
    } finally {
        readFunctionBtn.disabled = false;
    }
}

// Execute write function
async function executeWriteFunction() {
    const functionName = writeFunctionSelect.value;
    if (!functionName) {
        showError(writeResult, 'Please select a function');
        return;
    }

    if (!contract) {
        showError(writeResult, 'Contract not connected');
        return;
    }

    try {
        writeFunctionBtn.disabled = true;
        showLoading(true);
        clearResult(writeResult);
        
        const params = parseParameters(writeParams.value);
        const value = ethValue.value ? ethers.utils.parseEther(ethValue.value) : 0;
        
        console.log(`Calling ${functionName} with params:`, params, 'value:', value.toString());
        
        const options = {};
        if (value.gt(0)) {
            options.value = value;
        }
        
        const tx = await contract[functionName](...params, options);
        
        showSuccess(writeResult, `Transaction sent: ${tx.hash}`);
        addTransactionToHistory(tx.hash, functionName, 'pending');
        
        // Wait for confirmation
        const receipt = await tx.wait();
        
        if (receipt.status === 1) {
            showSuccess(writeResult, `Transaction confirmed!\nHash: ${tx.hash}\nBlock: ${receipt.blockNumber}`);
            updateTransactionStatus(tx.hash, 'success');
        } else {
            showError(writeResult, `Transaction failed: ${tx.hash}`);
            updateTransactionStatus(tx.hash, 'failed');
        }
        
    } catch (error) {
        console.error('Error executing write function:', error);
        showError(writeResult, `Error: ${error.message}`);
    } finally {
        writeFunctionBtn.disabled = false;
        showLoading(false);
    }
}

// Parse parameters from string
function parseParameters(paramString) {
    if (!paramString.trim()) return [];
    
    return paramString.split(',').map(param => {
        param = param.trim();
        
        // Try to parse as number if it looks like one
        if (/^\d+$/.test(param)) {
            return ethers.BigNumber.from(param);
        }
        
        // Return as string (addresses, etc.)
        return param;
    });
}

// Transaction history management
function addTransactionToHistory(hash, functionName, status) {
    // Remove "no transactions" message if it exists
    const noTransMsg = transactionHistory.querySelector('.no-transactions');
    if (noTransMsg) {
        noTransMsg.remove();
    }
    
    const txItem = document.createElement('div');
    txItem.className = 'transaction-item';
    txItem.dataset.hash = hash;
    
    txItem.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <strong>${functionName}</strong>
            <span class="transaction-status status-${status}">${status}</span>
        </div>
        <div class="transaction-hash">${hash}</div>
        <div style="font-size: 0.8em; color: #6c757d; margin-top: 5px;">
            ${new Date().toLocaleString()}
        </div>
    `;
    
    transactionHistory.insertBefore(txItem, transactionHistory.firstChild);
}

function updateTransactionStatus(hash, status) {
    const txItem = transactionHistory.querySelector(`[data-hash="${hash}"]`);
    if (txItem) {
        const statusElement = txItem.querySelector('.transaction-status');
        statusElement.className = `transaction-status status-${status}`;
        statusElement.textContent = status;
    }
}

// Utility functions
function showSuccess(element, message) {
    element.textContent = message;
    element.className = 'result-box success';
}

function showError(element, message) {
    element.textContent = message;
    element.className = 'result-box error';
}

function clearResult(element) {
    element.textContent = 'Loading...';
    element.className = 'result-box';
}

function showLoading(show) {
    if (show) {
        loadingModal.classList.remove('hidden');
    } else {
        loadingModal.classList.add('hidden');
    }
}

// Format address for display
function formatAddress(address) {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

// Format token amount
function formatTokenAmount(amount, decimals = 18) {
    return ethers.utils.formatUnits(amount, decimals);
}

// Validate Ethereum address
function isValidAddress(address) {
    return ethers.utils.isAddress(address);
}
