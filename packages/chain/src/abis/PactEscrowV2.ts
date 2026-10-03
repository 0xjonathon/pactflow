// Generated from Foundry artifact. Run pnpm contracts:abi.
export const pactEscrowV2Abi = [
  {
    "type": "constructor",
    "inputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "accept",
    "inputs": [],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "acceptanceDeadline",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint64",
        "internalType": "uint64"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "accepted",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "agreementHash",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "approve",
    "inputs": [
      {
        "name": "id",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "submissionId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "approvalHash",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "arbitrator",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "attest",
    "inputs": [
      {
        "name": "id",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "a",
        "type": "tuple",
        "internalType": "struct VerifierRegistryV2.Attestation",
        "components": [
          {
            "name": "pact",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "milestoneId",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "deliverableHash",
            "type": "bytes32",
            "internalType": "bytes32"
          },
          {
            "name": "rulesHash",
            "type": "bytes32",
            "internalType": "bytes32"
          },
          {
            "name": "submissionId",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "reportHash",
            "type": "bytes32",
            "internalType": "bytes32"
          },
          {
            "name": "approved",
            "type": "bool",
            "internalType": "bool"
          },
          {
            "name": "nonce",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "expiry",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "verifier",
            "type": "address",
            "internalType": "address"
          }
        ]
      },
      {
        "name": "signature",
        "type": "bytes",
        "internalType": "bytes"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "cancelBeforeAcceptance",
    "inputs": [],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "cancelled",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "claimReviewTimeout",
    "inputs": [
      {
        "name": "id",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "client",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "clientBondBalance",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "completed",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "expireMilestone",
    "inputs": [
      {
        "name": "id",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "factory",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "feeBps",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint16",
        "internalType": "uint16"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "fixedWorker",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "fund",
    "inputs": [],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "funded",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "guardian",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "initialize",
    "inputs": [
      {
        "name": "c",
        "type": "tuple",
        "internalType": "struct PactEscrowV2.Config",
        "components": [
          {
            "name": "client",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "worker",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "token",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "arbitrator",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "totalBudget",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "clientBond",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "workerBond",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "acceptanceDeadline",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "reviewPeriod",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "agreementHash",
            "type": "bytes32",
            "internalType": "bytes32"
          }
        ]
      },
      {
        "name": "inputs",
        "type": "tuple[]",
        "internalType": "struct PactEscrowV2.MilestoneInput[]",
        "components": [
          {
            "name": "amount",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "dueAt",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "rulesHash",
            "type": "bytes32",
            "internalType": "bytes32"
          },
          {
            "name": "mode",
            "type": "uint8",
            "internalType": "enum PactEscrowV2.Mode"
          },
          {
            "name": "maxRevisions",
            "type": "uint8",
            "internalType": "uint8"
          },
          {
            "name": "verifier",
            "type": "address",
            "internalType": "address"
          }
        ]
      },
      {
        "name": "verifierRegistry_",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "reputationRegistry_",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "treasury_",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "guardian_",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "feeBps_",
        "type": "uint16",
        "internalType": "uint16"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "initialized",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "milestone",
    "inputs": [
      {
        "name": "id",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "tuple",
        "internalType": "struct PactEscrowV2.Milestone",
        "components": [
          {
            "name": "amount",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "dueAt",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "rulesHash",
            "type": "bytes32",
            "internalType": "bytes32"
          },
          {
            "name": "mode",
            "type": "uint8",
            "internalType": "enum PactEscrowV2.Mode"
          },
          {
            "name": "deliverableHash",
            "type": "bytes32",
            "internalType": "bytes32"
          },
          {
            "name": "deliverableURI",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "reviewDeadline",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "submitted",
            "type": "bool",
            "internalType": "bool"
          },
          {
            "name": "clientApproved",
            "type": "bool",
            "internalType": "bool"
          },
          {
            "name": "aiAttested",
            "type": "bool",
            "internalType": "bool"
          },
          {
            "name": "disputed",
            "type": "bool",
            "internalType": "bool"
          },
          {
            "name": "settled",
            "type": "bool",
            "internalType": "bool"
          },
          {
            "name": "maxRevisions",
            "type": "uint8",
            "internalType": "uint8"
          },
          {
            "name": "verifier",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "submissionId",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "revisionRequired",
            "type": "bool",
            "internalType": "bool"
          },
          {
            "name": "reportHash",
            "type": "bytes32",
            "internalType": "bytes32"
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "milestoneCount",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "openDispute",
    "inputs": [
      {
        "name": "id",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "pause",
    "inputs": [],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "paused",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "protocolVersion",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "pure"
  },
  {
    "type": "function",
    "name": "releasedBudget",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "reputationRegistry",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract ReputationRegistryV2"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "requestRevision",
    "inputs": [
      {
        "name": "id",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "submissionId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "reasonHash",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "resolveDispute",
    "inputs": [
      {
        "name": "id",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "workerAward",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "clientSlash",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "workerSlash",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "reviewPeriod",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint64",
        "internalType": "uint64"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "settledBudget",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "settledCount",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "submissions",
    "inputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "evidenceHash",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "evidenceURI",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "submittedAt",
        "type": "uint64",
        "internalType": "uint64"
      },
      {
        "name": "reportHash",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "verdict",
        "type": "uint8",
        "internalType": "uint8"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "submit",
    "inputs": [
      {
        "name": "id",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "deliverableHash",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "deliverableURI",
        "type": "string",
        "internalType": "string"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "token",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract IERC20"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "totalBudget",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "treasury",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "unpause",
    "inputs": [],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "verifierRegistry",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract VerifierRegistryV2"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "worker",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "workerBondBalance",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "event",
    "name": "Accepted",
    "inputs": [
      {
        "name": "worker",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "workerBond",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "BondSlashed",
    "inputs": [
      {
        "name": "clientSlash",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "workerSlash",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "Cancelled",
    "inputs": [],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "ClientApprovalRecorded",
    "inputs": [
      {
        "name": "id",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "submissionId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "approvalHash",
        "type": "bytes32",
        "indexed": false,
        "internalType": "bytes32"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "Completed",
    "inputs": [],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "DisputeOpened",
    "inputs": [
      {
        "name": "id",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "opener",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "Funded",
    "inputs": [
      {
        "name": "budget",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "clientBond",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "MilestoneExpired",
    "inputs": [
      {
        "name": "id",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "MilestoneSettled",
    "inputs": [
      {
        "name": "id",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "workerAward",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "clientRefund",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "fee",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "Paused",
    "inputs": [
      {
        "name": "account",
        "type": "address",
        "indexed": false,
        "internalType": "address"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "RevisionRequested",
    "inputs": [
      {
        "name": "id",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "submissionId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "reportHash",
        "type": "bytes32",
        "indexed": false,
        "internalType": "bytes32"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "Submitted",
    "inputs": [
      {
        "name": "id",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "submissionId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "deliverableHash",
        "type": "bytes32",
        "indexed": false,
        "internalType": "bytes32"
      },
      {
        "name": "deliverableURI",
        "type": "string",
        "indexed": false,
        "internalType": "string"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "Unpaused",
    "inputs": [
      {
        "name": "account",
        "type": "address",
        "indexed": false,
        "internalType": "address"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "VerificationRecorded",
    "inputs": [
      {
        "name": "id",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "submissionId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "approved",
        "type": "bool",
        "indexed": false,
        "internalType": "bool"
      },
      {
        "name": "reportHash",
        "type": "bytes32",
        "indexed": false,
        "internalType": "bytes32"
      },
      {
        "name": "verifier",
        "type": "address",
        "indexed": false,
        "internalType": "address"
      }
    ],
    "anonymous": false
  },
  {
    "type": "error",
    "name": "EnforcedPause",
    "inputs": []
  },
  {
    "type": "error",
    "name": "ExpectedPause",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidAttestation",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidAward",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidConfig",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidDeadline",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidDeliverable",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidMilestones",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidState",
    "inputs": []
  },
  {
    "type": "error",
    "name": "ReentrancyGuardReentrantCall",
    "inputs": []
  },
  {
    "type": "error",
    "name": "SafeERC20FailedOperation",
    "inputs": [
      {
        "name": "token",
        "type": "address",
        "internalType": "address"
      }
    ]
  },
  {
    "type": "error",
    "name": "Unauthorized",
    "inputs": []
  },
  {
    "type": "error",
    "name": "UnsupportedToken",
    "inputs": []
  }
] as const;
