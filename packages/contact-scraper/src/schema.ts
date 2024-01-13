export const JSON_SCHEMA = {
    type: 'object',
    properties: {
        emails: {
            type: 'array',
            description: 'Email addresses',
            items: {
                type: 'object',
                properties: {
                    item: {
                        type: 'string',
                        description: 'Email address',
                    },
                    description: {
                        type: 'string',
                    },
                },
            },
        },
        phones: {
            type: 'array',
            description: 'Phone numbers',
            items: {
                type: 'object',
                properties: {
                    item: {
                        type: 'string',
                        description: 'Phone number',
                    },
                    description: {
                        type: 'string',
                    },
                },
            },
        },
        linkedin: {
            type: 'array',
            description: 'LinkedIn URLs',
            items: {
                type: 'object',
                properties: {
                    item: {
                        type: 'string',
                        description: 'LinkedIn URL',
                    },
                    description: {
                        type: 'string',
                    },
                },
            },
        },
        twitter: {
            type: 'array',
            description: 'Twitter URLs',
            items: {
                type: 'object',
                properties: {
                    item: {
                        type: 'string',
                        description: 'Twitter URL',
                    },
                    description: {
                        type: 'string',
                    },
                },
            },
        },
        instagram: {
            type: 'array',
            description: 'Instagram URLs',
            items: {
                type: 'object',
                properties: {
                    item: {
                        type: 'string',
                        description: 'Instagram URL',
                    },
                    description: {
                        type: 'string',
                    },
                },
            },
        },
        facebook: {
            type: 'array',
            description: 'Facebook URLs',
            items: {
                type: 'object',
                properties: {
                    item: {
                        type: 'string',
                        description: 'Facebook URL',
                    },
                    description: {
                        type: 'string',
                    },
                },
            },
        },
        youtube: {
            type: 'array',
            description: 'YouTube URLs',
            items: {
                type: 'object',
                properties: {
                    item: {
                        type: 'string',
                        description: 'YouTube URL',
                    },
                    description: {
                        type: 'string',
                    },
                },
            },
        },
        pinterest: {
            type: 'array',
            description: 'Pinterest URLs',
            items: {
                type: 'object',
                properties: {
                    item: {
                        type: 'string',
                        description: 'Pinterest URL',
                    },
                    description: {
                        type: 'string',
                    },
                },
            },
        },
        discord: {
            type: 'array',
            description: 'Discord URLs',
            items: {
                type: 'object',
                properties: {
                    item: {
                        type: 'string',
                        description: 'Discord URL',
                    },
                    description: {
                        type: 'string',
                    },
                },
            },
        },
        tiktok: {
            type: 'array',
            description: 'TikTok URLs',
            items: {
                type: 'object',
                properties: {
                    item: {
                        type: 'string',
                        description: 'TikTok URL',
                    },
                    description: {
                        type: 'string',
                    },
                },
            },
        },
    },
};
