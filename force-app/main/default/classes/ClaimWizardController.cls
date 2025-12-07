public with sharing class ClaimWizardController {
   //  Retrieve Contract and Property Details
   @AuraEnabled(cacheable = true)
   public static Contract getContractDetails(String contractNumber) {
      try{
         return [SELECT Id, ContractNumber, StartDate, EndDate, 
                           AccountId, Account.Name, 
                           Assured_Property__c, Assured_Property__r.Name, 
                           Assured_Property__r.Address__c, Assured_Property__r.Type__c
                    FROM Contract 
                    WHERE ContractNumber = :contractNumber 
                    LIMIT 1];
      } catch(Exception e){
         return null;
      } 
   }
   // Find Available Experts (Collision Detection Logic)
   @AuraEnabled(cacheable=true)
   public static List<User> getAvailableExperts(DateTime targetDate) {
      DateTime endTime = targetDate.addHours(1); // Durée 1h par défaut
        // Trouver les experts occupés
        List<Event> conflicts = [SELECT OwnerId FROM Event 
                                 WHERE StartDateTime < :endTime 
                                 AND EndDateTime > :targetDate];
        
        Set<Id> busyIds = new Set<Id>();
        for(Event e : conflicts) { busyIds.add(e.OwnerId); }
        // Retourner les experts libres (Filtrer par Profil si besoin)
        // Note: Assurez-vous que vos experts ont bien un profil contenant "Expert"
        return [SELECT Id, Name FROM User 
                WHERE Profile.Name LIKE '%Expert%' 
                AND Id NOT IN :busyIds];
   }
   // 3. Save Claim + Appointment Transactionally
   @AuraEnabled
   public static String createClaim(Claim__c newClaim, String expertId, DateTime appointmentDate,String locationAddress) {
      try {
         newClaim.Expert_Appointment_Time__c = appointmentDate;
         newClaim.Property_Address__c = locationAddress;
         newClaim.Status__c ='New';
            insert newClaim;

            if(expertId != null && appointmentDate != null) {
                Event rdv = new Event();
                rdv.Subject = 'Claim Expertise: ' + newClaim.id;
                rdv.StartDateTime = appointmentDate;
                rdv.EndDateTime = appointmentDate.addHours(1);
                rdv.OwnerId = expertId;
                rdv.Location = locationAddress;
                rdv.WhatId = newClaim.Id; 
                insert rdv;
            }
            return newClaim.Id;
      } 
      catch (Exception e) {
            throw new AuraHandledException('Erreur: ' + e.getMessage());
        }
   }
}