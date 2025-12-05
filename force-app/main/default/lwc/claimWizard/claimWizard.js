import { LightningElement, track } from 'lwc';
// Assurez-vous d'avoir la bonne référence Apex ici
import getContractDetails from '@salesforce/apex/ClaimWizardController.getContractDetails'; 
import getAvailableExperts from '@salesforce/apex/ClaimWizardController.getAvailableExperts';
import createClaim from '@salesforce/apex/ClaimWizardController.createClaim';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

export default class AgentClaimWizard extends LightningElement {
    @track currentStep = "1";
    
    // Data
    contractNumInput = '';
    @track contractData;
    @track claimData = {
        sobjectType: 'Claim__c',
        Incident_Date__c: null,
        Incident_Type__c: '',
        Priority__c: 'Medium',
        Description__c: ''
    };
    
    // Expert
    selectedDate;
    selectedExpertId;
    @track expertsList;

    // --- GETTERS (For HTML rendering) ---
    get isStep1() { return this.currentStep === "1"; }
    get isStep2() { return this.currentStep === "2"; }
    get isStep3() { return this.currentStep === "3"; }
    
    // Incident Type Picklist Values (No change needed)
    get typeOptions() {
        return [
            { label: 'Water Damage', value: 'Water Damage' },
            { label: 'Fire', value: 'Fire' },
            { label: 'Theft', value: 'Theft' },
            { label: 'Glass Breakage', value: 'Glass Breakage' },
            { label: 'Natural Disaster', value: 'Natural Disaster' }
        ];
    }
    // Priority Picklist Values (No change needed)
    get priorityOptions() {
        return [
            { label: 'Low', value: 'Low' },
            { label: 'Medium', value: 'Medium' },
            { label: 'High', value: 'High' }
        ];
    }
    
    get disableNext() {
        // Validation logic for stepping forward
        if(this.currentStep === "1" && !this.contractData) return true;
        if(this.currentStep === "2" && (!this.claimData.Incident_Type__c || !this.claimData.Description__c)) return true;
        return false;
    }

    // --- STEP 1: Contract ---
    handleInputChange(event) { this.contractNumInput = event.target.value; }

    searchContract() {
        getContractDetails({ contractNumber: this.contractNumInput })
            .then(result => {
                // IMPORTANT: Mettre à jour l'objet "contractData" pour qu'il soit propre
                if(result) {
                    this.contractData = {
                        Id: result.Id,
                        ContractNumber: result.ContractNumber,
                        StartDate: result.StartDate,
                        EndDate: result.EndDate,
                        AccountId: result.AccountId,
                        
                        // Sécuriser les champs de relation
                        AccountName: result.Account ? result.Account.Name : 'Unknown Client', // Traduit
                        PropertyName: result.assured_Property__r ? result.assured_Property__r.Name : 'No Property Assigned', // Traduit
                        PropertyType: result.assured_Property__r ? result.assured_Property__r.Type__c : '-',
                        PropertyAddress: result.assured_Property__r ? result.assured_Property__r.Address__c : '-'
                    };
                    
                    // Traduction des messages
                    this.showToast('Success', 'Contract found', 'success');
                } else {
                    this.contractData = null;
                    // Traduction des messages
                    this.showToast('Error', 'Contract not found', 'error');
                }
            })
            .catch(error => { 
                // Traduction des messages
                console.error(error); 
                this.showToast('Error', 'Server issue or invalid access', 'error'); 
            });
    }

    // --- STEP 2: Input ---
    handleClaimField(event) {
        const field = event.target.dataset.field;
        this.claimData[field] = event.target.value;
    }

    // --- STEP 3: Expert ---
    handleDateChange(event) {
        this.selectedDate = event.target.value;
        if(this.selectedDate) {
            getAvailableExperts({ targetDate: this.selectedDate })
                .then(result => {
                    this.expertsList = result.map(user => {
                        return { label: user.Name, value: user.Id };
                    });
                    // Traduction des messages
                    if(this.expertsList.length === 0) this.showToast('Info', 'No expert available at this time', 'warning');
                });
        }
    }

    handleExpertSelect(event) { this.selectedExpertId = event.target.value; }

    // --- NAVIGATION & SAVE ---
    goNext() { this.currentStep = (parseInt(this.currentStep) + 1).toString(); }
    goBack() { this.currentStep = (parseInt(this.currentStep) - 1).toString(); }

    saveAll() {
        // Final data preparation
        this.claimData.Contract__c = this.contractData.Id;
        this.claimData.Assigned_Expert__c = this.selectedExpertId;
        const propertyAddress = this.contractData.PropertyAddress;

        createClaim({ 
            newClaim: this.claimData, 
            expertId: this.selectedExpertId, 
            appointmentDate: this.selectedDate,
            locationAddress: propertyAddress
        })
        .then(claimId => {
            // Traduction des messages
            this.showToast('Success', 'Claim created: ' + claimId, 'success');
            // Reset form or navigate
            this.currentStep = "1";
            this.contractData = null;
        })
        .catch(error => {
            // Traduction des messages
            this.showToast('Error', error.body.message, 'error');
        });
    }

    showToast(title, message, variant) {
        this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
    }
}