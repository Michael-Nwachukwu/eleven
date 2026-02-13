/**
 * useAeonBanks Hook
 * 
 * Manages Nigerian bank list and account verification via Aeon API
 */

import { useState, useEffect, useCallback } from 'react'
import {
    getAeonBankTransferClient,
    Bank,
    FALLBACK_NIGERIAN_BANKS
} from '@/services/aeon-bank-transfer'

interface UseAeonBanksReturn {
    // Bank list
    banks: Bank[]
    banksLoading: boolean
    banksError: string | null
    refetchBanks: () => Promise<void>

    // Account verification
    verifyAccount: (bankCode: string, accountNumber: string) => Promise<string | null>
    verificationLoading: boolean
    verificationError: string | null
    verifiedAccountName: string | null
    clearVerification: () => void
}

export function useAeonBanks(): UseAeonBanksReturn {
    const [banks, setBanks] = useState<Bank[]>(FALLBACK_NIGERIAN_BANKS)
    const [banksLoading, setBanksLoading] = useState(true)
    const [banksError, setBanksError] = useState<string | null>(null)

    const [verificationLoading, setVerificationLoading] = useState(false)
    const [verificationError, setVerificationError] = useState<string | null>(null)
    const [verifiedAccountName, setVerifiedAccountName] = useState<string | null>(null)

    /**
     * Fetch bank list from Aeon
     */
    const fetchBanks = useCallback(async () => {
        setBanksLoading(true)
        setBanksError(null)

        try {
            const client = getAeonBankTransferClient(true) // Use sandbox
            const response = await client.getAccountForm('NGN')

            if (response.success && response.model?.dataSource?.bankList) {
                const aeonBanks = response.model.dataSource.bankList
                console.log(`Loaded ${aeonBanks.length} banks from Aeon`)
                setBanks(aeonBanks)
            } else {
                console.warn('Failed to load banks from Aeon, using fallback:', response.msg)
                setBanksError(response.msg || 'Failed to load banks')
                setBanks(FALLBACK_NIGERIAN_BANKS)
            }
        } catch (error: any) {
            console.error('Error fetching banks:', error)
            setBanksError(error.message || 'Failed to load banks')
            setBanks(FALLBACK_NIGERIAN_BANKS)
        } finally {
            setBanksLoading(false)
        }
    }, [])

    /**
     * Verify bank account and get account name
     */
    const verifyAccount = useCallback(async (
        bankCode: string,
        accountNumber: string
    ): Promise<string | null> => {
        // Validate input
        if (!bankCode || !accountNumber) {
            setVerificationError('Bank code and account number are required')
            return null
        }

        if (accountNumber.length !== 10) {
            setVerificationError('Account number must be 10 digits')
            return null
        }

        setVerificationLoading(true)
        setVerificationError(null)
        setVerifiedAccountName(null)

        try {
            const client = getAeonBankTransferClient(true) // Use sandbox
            const response = await client.verifyBankAccount(bankCode, accountNumber, 'NGN')

            if (response.success && response.model?.accountName) {
                const accountName = response.model.accountName
                setVerifiedAccountName(accountName)
                console.log('Account verified:', accountName)
                return accountName
            } else {
                const errorMsg = response.msg || 'Account verification failed'
                setVerificationError(errorMsg)
                console.warn('Account verification failed:', errorMsg)
                return null
            }
        } catch (error: any) {
            const errorMsg = error.message || 'Account verification failed'
            setVerificationError(errorMsg)
            console.error('Account verification error:', error)
            return null
        } finally {
            setVerificationLoading(false)
        }
    }, [])

    /**
     * Clear verification state
     */
    const clearVerification = useCallback(() => {
        setVerifiedAccountName(null)
        setVerificationError(null)
        setVerificationLoading(false)
    }, [])

    // Fetch banks on mount
    useEffect(() => {
        fetchBanks()
    }, [fetchBanks])

    return {
        banks,
        banksLoading,
        banksError,
        refetchBanks: fetchBanks,

        verifyAccount,
        verificationLoading,
        verificationError,
        verifiedAccountName,
        clearVerification,
    }
}
