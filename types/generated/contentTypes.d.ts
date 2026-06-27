import type { Schema, Struct } from '@strapi/strapi';

export interface AdminApiToken extends Struct.CollectionTypeSchema {
  collectionName: 'strapi_api_tokens';
  info: {
    description: '';
    displayName: 'Api Token';
    name: 'Api Token';
    pluralName: 'api-tokens';
    singularName: 'api-token';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    accessKey: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    description: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }> &
      Schema.Attribute.DefaultTo<''>;
    encryptedKey: Schema.Attribute.Text &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    expiresAt: Schema.Attribute.DateTime;
    lastUsedAt: Schema.Attribute.DateTime;
    lifespan: Schema.Attribute.BigInteger;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<'oneToMany', 'admin::api-token'> &
      Schema.Attribute.Private;
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    permissions: Schema.Attribute.Relation<
      'oneToMany',
      'admin::api-token-permission'
    >;
    publishedAt: Schema.Attribute.DateTime;
    type: Schema.Attribute.Enumeration<['read-only', 'full-access', 'custom']> &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'read-only'>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface AdminApiTokenPermission extends Struct.CollectionTypeSchema {
  collectionName: 'strapi_api_token_permissions';
  info: {
    description: '';
    displayName: 'API Token Permission';
    name: 'API Token Permission';
    pluralName: 'api-token-permissions';
    singularName: 'api-token-permission';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    action: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'admin::api-token-permission'
    > &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    token: Schema.Attribute.Relation<'manyToOne', 'admin::api-token'>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface AdminPermission extends Struct.CollectionTypeSchema {
  collectionName: 'admin_permissions';
  info: {
    description: '';
    displayName: 'Permission';
    name: 'Permission';
    pluralName: 'permissions';
    singularName: 'permission';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    action: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    actionParameters: Schema.Attribute.JSON & Schema.Attribute.DefaultTo<{}>;
    conditions: Schema.Attribute.JSON & Schema.Attribute.DefaultTo<[]>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<'oneToMany', 'admin::permission'> &
      Schema.Attribute.Private;
    properties: Schema.Attribute.JSON & Schema.Attribute.DefaultTo<{}>;
    publishedAt: Schema.Attribute.DateTime;
    role: Schema.Attribute.Relation<'manyToOne', 'admin::role'>;
    subject: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface AdminRole extends Struct.CollectionTypeSchema {
  collectionName: 'admin_roles';
  info: {
    description: '';
    displayName: 'Role';
    name: 'Role';
    pluralName: 'roles';
    singularName: 'role';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    code: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    description: Schema.Attribute.String;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<'oneToMany', 'admin::role'> &
      Schema.Attribute.Private;
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    permissions: Schema.Attribute.Relation<'oneToMany', 'admin::permission'>;
    publishedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    users: Schema.Attribute.Relation<'manyToMany', 'admin::user'>;
  };
}

export interface AdminSession extends Struct.CollectionTypeSchema {
  collectionName: 'strapi_sessions';
  info: {
    description: 'Session Manager storage';
    displayName: 'Session';
    name: 'Session';
    pluralName: 'sessions';
    singularName: 'session';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
    i18n: {
      localized: false;
    };
  };
  attributes: {
    absoluteExpiresAt: Schema.Attribute.DateTime & Schema.Attribute.Private;
    childId: Schema.Attribute.String & Schema.Attribute.Private;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    deviceId: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Private;
    expiresAt: Schema.Attribute.DateTime &
      Schema.Attribute.Required &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<'oneToMany', 'admin::session'> &
      Schema.Attribute.Private;
    origin: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    sessionId: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Private &
      Schema.Attribute.Unique;
    status: Schema.Attribute.String & Schema.Attribute.Private;
    type: Schema.Attribute.String & Schema.Attribute.Private;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    userId: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Private;
  };
}

export interface AdminTransferToken extends Struct.CollectionTypeSchema {
  collectionName: 'strapi_transfer_tokens';
  info: {
    description: '';
    displayName: 'Transfer Token';
    name: 'Transfer Token';
    pluralName: 'transfer-tokens';
    singularName: 'transfer-token';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    accessKey: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    description: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }> &
      Schema.Attribute.DefaultTo<''>;
    expiresAt: Schema.Attribute.DateTime;
    lastUsedAt: Schema.Attribute.DateTime;
    lifespan: Schema.Attribute.BigInteger;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'admin::transfer-token'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    permissions: Schema.Attribute.Relation<
      'oneToMany',
      'admin::transfer-token-permission'
    >;
    publishedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface AdminTransferTokenPermission
  extends Struct.CollectionTypeSchema {
  collectionName: 'strapi_transfer_token_permissions';
  info: {
    description: '';
    displayName: 'Transfer Token Permission';
    name: 'Transfer Token Permission';
    pluralName: 'transfer-token-permissions';
    singularName: 'transfer-token-permission';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    action: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'admin::transfer-token-permission'
    > &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    token: Schema.Attribute.Relation<'manyToOne', 'admin::transfer-token'>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface AdminUser extends Struct.CollectionTypeSchema {
  collectionName: 'admin_users';
  info: {
    description: '';
    displayName: 'User';
    name: 'User';
    pluralName: 'users';
    singularName: 'user';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    blocked: Schema.Attribute.Boolean &
      Schema.Attribute.Private &
      Schema.Attribute.DefaultTo<false>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    email: Schema.Attribute.Email &
      Schema.Attribute.Required &
      Schema.Attribute.Private &
      Schema.Attribute.Unique &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 6;
      }>;
    firstname: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    isActive: Schema.Attribute.Boolean &
      Schema.Attribute.Private &
      Schema.Attribute.DefaultTo<false>;
    lastname: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<'oneToMany', 'admin::user'> &
      Schema.Attribute.Private;
    password: Schema.Attribute.Password &
      Schema.Attribute.Private &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 6;
      }>;
    preferedLanguage: Schema.Attribute.String;
    publishedAt: Schema.Attribute.DateTime;
    registrationToken: Schema.Attribute.String & Schema.Attribute.Private;
    resetPasswordToken: Schema.Attribute.String & Schema.Attribute.Private;
    roles: Schema.Attribute.Relation<'manyToMany', 'admin::role'> &
      Schema.Attribute.Private;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    username: Schema.Attribute.String;
  };
}

export interface ApiAdvertisementOrderAdvertisementOrder
  extends Struct.CollectionTypeSchema {
  collectionName: 'advertisement_orders';
  info: {
    displayName: 'AdvertisementOrder ';
    pluralName: 'advertisement-orders';
    singularName: 'advertisement-order';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    email: Schema.Attribute.Email;
    fund_contribution: Schema.Attribute.Decimal;
    item3_status: Schema.Attribute.Enumeration<
      ['pending', 'confirmed', 'completed']
    >;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::advertisement-order.advertisement-order'
    > &
      Schema.Attribute.Private;
    neighborhood_count: Schema.Attribute.Integer;
    neighborhood_label: Schema.Attribute.String;
    publishedAt: Schema.Attribute.DateTime;
    selected_items: Schema.Attribute.JSON;
    total_monthly: Schema.Attribute.Decimal;
    total_payment: Schema.Attribute.Decimal;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiAdvertisementAdvertisement
  extends Struct.CollectionTypeSchema {
  collectionName: 'advertisements';
  info: {
    displayName: 'Advertisement';
    pluralName: 'advertisements';
    singularName: 'advertisement';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    color: Schema.Attribute.String;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    cta: Schema.Attribute.String;
    description: Schema.Attribute.Text;
    href: Schema.Attribute.String;
    image: Schema.Attribute.Media<
      'images' | 'files' | 'videos' | 'audios',
      true
    >;
    item1_status: Schema.Attribute.Enumeration<['active', 'inactive']>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::advertisement.advertisement'
    > &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    title: Schema.Attribute.String;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiChActivityItemChActivityItem
  extends Struct.CollectionTypeSchema {
  collectionName: 'ch_activity_items';
  info: {
    description: '\u05E4\u05E2\u05D9\u05DC\u05D5\u05EA (\u05E1\u05E8\u05D8\u05D5\u05DF/\u05DE\u05D0\u05DE\u05E8/\u05D4\u05D5\u05D3\u05E2\u05D4/\u05DB\u05EA\u05D1\u05D4) \u05D1\u05D4\u05D9\u05DB\u05DC \u05D4\u05DE\u05E2\u05E9\u05D4 \u2014 \u05E9\u05D3\u05D5\u05EA \u05E8\u05D1-\u05DC\u05E9\u05D5\u05E0\u05D9\u05D9\u05DD.';
    displayName: 'Chachmei \u00B7 Activity Item';
    pluralName: 'ch-activity-items';
    singularName: 'ch-activity-item';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    activityDate: Schema.Attribute.Date & Schema.Attribute.Required;
    author: Schema.Attribute.JSON;
    body: Schema.Attribute.JSON;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    excerpt: Schema.Attribute.JSON;
    imageUrl: Schema.Attribute.String;
    kind: Schema.Attribute.JSON & Schema.Attribute.Required;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::ch-activity-item.ch-activity-item'
    > &
      Schema.Attribute.Private;
    order: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<100>;
    publishedAt: Schema.Attribute.DateTime;
    slug: Schema.Attribute.UID & Schema.Attribute.Required;
    sourceUrl: Schema.Attribute.String;
    tags: Schema.Attribute.JSON;
    title: Schema.Attribute.JSON & Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    videoUrl: Schema.Attribute.String;
  };
}

export interface ApiChArticleChArticle extends Struct.CollectionTypeSchema {
  collectionName: 'ch_articles';
  info: {
    description: '\u05DE\u05D0\u05DE\u05E8\u05D9\u05DD \u05D1\u05D4\u05D9\u05DB\u05DC \u05D4\u05E8\u05D5\u05D7 \u05E9\u05DC \u05D7\u05DB\u05DE\u05D9 \u05D4\u05E2\u05D3\u05D4 \u2014 title/author/excerpt/body \u05DB-JSON \u05E8\u05D1 \u05DC\u05E9\u05D5\u05E0\u05D9 (he/en/ru).';
    displayName: 'Chachmei \u00B7 Article';
    pluralName: 'ch-articles';
    singularName: 'ch-article';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    approvedBy: Schema.Attribute.JSON;
    articleDate: Schema.Attribute.Date & Schema.Attribute.Required;
    author: Schema.Attribute.JSON & Schema.Attribute.Required;
    body: Schema.Attribute.JSON;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    excerpt: Schema.Attribute.JSON;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::ch-article.ch-article'
    > &
      Schema.Attribute.Private;
    order: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<100>;
    publishedAt: Schema.Attribute.DateTime;
    slug: Schema.Attribute.UID & Schema.Attribute.Required;
    tags: Schema.Attribute.JSON;
    title: Schema.Attribute.JSON & Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiChCharterSignatureChCharterSignature
  extends Struct.CollectionTypeSchema {
  collectionName: 'ch_charter_signatures';
  info: {
    description: '\u05D7\u05EA\u05D9\u05DE\u05D5\u05EA \u05E2\u05DC \u05D0\u05DE\u05E0\u05EA UECC \u05E9\u05DC \u05D7\u05DB\u05DE\u05D9 \u05D4\u05E2\u05D3\u05D4 \u2014 \u05E9\u05DD, \u05E2\u05E1\u05E7, \u05EA\u05E4\u05E7\u05D9\u05D3, \u05E2\u05D9\u05E8, \u05E4\u05E8\u05D8\u05D9 \u05E7\u05E9\u05E8. \u05E9\u05D3\u05D5\u05EA \u05DE\u05D5\u05DC\u05DE\u05D3\u05D9\u05DD \u05DE\u05D0\u05D5\u05D7\u05E1\u05E0\u05D9\u05DD \u05DB-JSON (he/en/ru).';
    displayName: 'Chachmei \u00B7 Charter Signature';
    pluralName: 'ch-charter-signatures';
    singularName: 'ch-charter-signature';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    acceptedTerms: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    birthDate: Schema.Attribute.String & Schema.Attribute.Private;
    businessName: Schema.Attribute.JSON;
    city: Schema.Attribute.JSON;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    disqualifiedBy: Schema.Attribute.JSON;
    disqualifiedDate: Schema.Attribute.Date;
    disqualifiedReason: Schema.Attribute.JSON;
    email: Schema.Attribute.String & Schema.Attribute.Private;
    idNumber: Schema.Attribute.String & Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::ch-charter-signature.ch-charter-signature'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.JSON & Schema.Attribute.Required;
    phone: Schema.Attribute.String & Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    role: Schema.Attribute.JSON;
    signedDate: Schema.Attribute.Date & Schema.Attribute.Required;
    status: Schema.Attribute.Enumeration<['signed', 'disqualified']> &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'signed'>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiChHearingRequestChHearingRequest
  extends Struct.CollectionTypeSchema {
  collectionName: 'ch_hearing_requests';
  info: {
    description: '\u05D1\u05E7\u05E9\u05D5\u05EA \u05DC\u05E4\u05EA\u05D9\u05D7\u05EA \u05D3\u05D9\u05D5\u05DF \u05E9\u05D4\u05D5\u05D2\u05E9\u05D5 \u05D3\u05E8\u05DA /request-hearing.';
    displayName: 'Chachmei \u00B7 Hearing Request';
    pluralName: 'ch-hearing-requests';
    singularName: 'ch-hearing-request';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    amount: Schema.Attribute.String;
    caseDescription: Schema.Attribute.Text & Schema.Attribute.Required;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    documentsNotes: Schema.Attribute.Text;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::ch-hearing-request.ch-hearing-request'
    > &
      Schema.Attribute.Private;
    oppositeParty: Schema.Attribute.String;
    publishedAt: Schema.Attribute.DateTime;
    requesterEmail: Schema.Attribute.String & Schema.Attribute.Private;
    requesterName: Schema.Attribute.String & Schema.Attribute.Required;
    requesterPhone: Schema.Attribute.String & Schema.Attribute.Private;
    status: Schema.Attribute.Enumeration<
      ['pending', 'accepted', 'rejected', 'scheduled']
    > &
      Schema.Attribute.DefaultTo<'pending'>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiChHearingChHearing extends Struct.CollectionTypeSchema {
  collectionName: 'ch_hearings';
  info: {
    description: '\u05D3\u05D9\u05D5\u05E0\u05D9 \u05D1\u05D9\u05EA \u05D4\u05D3\u05D9\u05DF UECC \u2014 \u05DE\u05EA\u05D5\u05DB\u05E0\u05E0\u05D9\u05DD \u05D5\u05D4\u05EA\u05E7\u05D9\u05D9\u05DE\u05D5.';
    displayName: 'Chachmei \u00B7 Hearing';
    pluralName: 'ch-hearings';
    singularName: 'ch-hearing';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    caseName: Schema.Attribute.JSON & Schema.Attribute.Required;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    dayanim: Schema.Attribute.JSON;
    hearingDate: Schema.Attribute.Date & Schema.Attribute.Required;
    hearingTime: Schema.Attribute.String;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::ch-hearing.ch-hearing'
    > &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    status: Schema.Attribute.Enumeration<['planned', 'done', 'cancelled']> &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'planned'>;
    summary: Schema.Attribute.JSON;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    zoomLink: Schema.Attribute.String;
  };
}

export interface ApiChHomeConfigChHomeConfig extends Struct.SingleTypeSchema {
  collectionName: 'ch_home_configs';
  info: {
    description: '\u05D4\u05D2\u05D3\u05E8\u05D5\u05EA \u05E2\u05DE\u05D5\u05D3 \u05D4\u05D1\u05D9\u05EA \u05E9\u05DC \u05D7\u05DB\u05DE\u05D9 \u05D4\u05E2\u05D3\u05D4 \u2014 \u05E1\u05E8\u05D8\u05D5\u05DF \u05E4\u05EA\u05D9\u05D7\u05D4 \u05D5\u05E2\u05D5\u05D3.';
    displayName: 'Chachmei \u00B7 Home Config';
    pluralName: 'ch-home-configs';
    singularName: 'ch-home-config';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    homeVideoTitle: Schema.Attribute.String;
    homeVideoUrl: Schema.Attribute.String;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::ch-home-config.ch-home-config'
    > &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiChNewsItemChNewsItem extends Struct.CollectionTypeSchema {
  collectionName: 'ch_news_items';
  info: {
    description: '\u05E4\u05E8\u05D9\u05D8\u05D9 \u05D7\u05D3\u05E9\u05D5\u05EA \u05E2\u05D1\u05D5\u05E8 \u05D4\u05E1\u05D9\u05E4\u05D5\u05E8 \u05D4\u05E8\u05D0\u05E9\u05D9 \u05D1\u05D0\u05EA\u05E8 \u05D7\u05DB\u05DE\u05D9 \u05D4\u05E2\u05D3\u05D4.';
    displayName: 'Chachmei \u00B7 News Item';
    pluralName: 'ch-news-items';
    singularName: 'ch-news-item';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    active: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    line1: Schema.Attribute.JSON & Schema.Attribute.Required;
    line2: Schema.Attribute.JSON;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::ch-news-item.ch-news-item'
    > &
      Schema.Attribute.Private;
    order: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<100>;
    publishedAt: Schema.Attribute.DateTime;
    sourceUrl: Schema.Attribute.String;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiChQaItemChQaItem extends Struct.CollectionTypeSchema {
  collectionName: 'ch_qa_items';
  info: {
    description: '\u05E9\u05D5"\u05EA \u05E9\u05E4\u05D5\u05E8\u05E1\u05DD \u05E2\u05DC \u05D9\u05D3\u05D9 \u05D7\u05DB\u05DE\u05D9 \u05D4\u05E2\u05D3\u05D4 \u2014 \u05E9\u05D0\u05DC\u05D4 \u05D5\u05EA\u05E9\u05D5\u05D1\u05D4 \u05E8\u05D1-\u05DC\u05E9\u05D5\u05E0\u05D9\u05D9\u05DD (he/en/ru).';
    displayName: 'Chachmei \u00B7 Q&A Item';
    pluralName: 'ch-qa-items';
    singularName: 'ch-qa-item';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    answer: Schema.Attribute.JSON & Schema.Attribute.Required;
    answerDate: Schema.Attribute.Date;
    answeredBy: Schema.Attribute.JSON;
    askDate: Schema.Attribute.Date;
    asker: Schema.Attribute.JSON;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::ch-qa-item.ch-qa-item'
    > &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    question: Schema.Attribute.JSON & Schema.Attribute.Required;
    slug: Schema.Attribute.UID & Schema.Attribute.Required;
    topic: Schema.Attribute.JSON & Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiChQuestionSubmissionChQuestionSubmission
  extends Struct.CollectionTypeSchema {
  collectionName: 'ch_question_submissions';
  info: {
    description: '\u05E9\u05D0\u05DC\u05D5\u05EA \u05E9\u05E0\u05E9\u05DC\u05D7\u05D5 \u05E2\u05DC \u05D9\u05D3\u05D9 \u05DE\u05E9\u05EA\u05DE\u05E9\u05D9\u05DD \u05D3\u05E8\u05DA /ask \u2014 \u05DE\u05DE\u05EA\u05D9\u05E0\u05D5\u05EA \u05DC\u05EA\u05E9\u05D5\u05D1\u05EA \u05D7\u05DB\u05DE\u05D9 \u05D4\u05E2\u05D3\u05D4.';
    displayName: 'Chachmei \u00B7 Question Submission';
    pluralName: 'ch-question-submissions';
    singularName: 'ch-question-submission';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    askerEmail: Schema.Attribute.String & Schema.Attribute.Private;
    askerName: Schema.Attribute.String & Schema.Attribute.Required;
    askerPhone: Schema.Attribute.String & Schema.Attribute.Private;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::ch-question-submission.ch-question-submission'
    > &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    publishedQaSlug: Schema.Attribute.String;
    question: Schema.Attribute.Text & Schema.Attribute.Required;
    status: Schema.Attribute.Enumeration<['pending', 'answered', 'rejected']> &
      Schema.Attribute.DefaultTo<'pending'>;
    topic: Schema.Attribute.String;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiChRabbiChRabbi extends Struct.CollectionTypeSchema {
  collectionName: 'ch_rabbis';
  info: {
    description: '\u05E8\u05D1\u05E0\u05D9 \u05D7\u05DB\u05DE\u05D9 \u05D4\u05E2\u05D3\u05D4 \u2014 \u05E9\u05DE\u05D5\u05EA \u05D1\u05E2\u05D1\u05E8\u05D9\u05EA/\u05D0\u05E0\u05D2\u05DC\u05D9\u05EA/\u05E8\u05D5\u05E1\u05D9\u05EA, \u05EA\u05DE\u05D5\u05E0\u05D4, \u05DB\u05EA\u05D5\u05D1\u05EA.';
    displayName: 'Chachmei \u00B7 Rabbi';
    pluralName: 'ch-rabbis';
    singularName: 'ch-rabbi';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::ch-rabbi.ch-rabbi'
    > &
      Schema.Attribute.Private;
    order: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<100>;
    photo: Schema.Attribute.String;
    publishedAt: Schema.Attribute.DateTime;
    rabbiCity: Schema.Attribute.JSON;
    rabbiName: Schema.Attribute.JSON & Schema.Attribute.Required;
    rabbiNickname: Schema.Attribute.JSON;
    rabbiTitle: Schema.Attribute.JSON;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiChRulingChRuling extends Struct.CollectionTypeSchema {
  collectionName: 'ch_rulings';
  info: {
    description: '\u05E4\u05E1\u05E7\u05D9 \u05D3\u05D9\u05DF \u05E9\u05E4\u05D5\u05E8\u05E1\u05DE\u05D5 \u05E2\u05DC \u05D9\u05D3\u05D9 \u05D1\u05D9\u05EA \u05D4\u05D3\u05D9\u05DF UECC.';
    displayName: 'Chachmei \u00B7 Ruling';
    pluralName: 'ch-rulings';
    singularName: 'ch-ruling';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    caseName: Schema.Attribute.JSON & Schema.Attribute.Required;
    caseRef: Schema.Attribute.String;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    dayanim: Schema.Attribute.JSON;
    decision: Schema.Attribute.JSON;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::ch-ruling.ch-ruling'
    > &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    rulingDate: Schema.Attribute.Date & Schema.Attribute.Required;
    summary: Schema.Attribute.JSON;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiCharterSignatureCharterSignature
  extends Struct.CollectionTypeSchema {
  collectionName: 'charter_signatures';
  info: {
    description: '\u05D7\u05EA\u05D9\u05DE\u05D5\u05EA \u05E2\u05DC \u05D0\u05DE\u05E0\u05EA \u05D4\u05E7\u05D4\u05D9\u05DC\u05D4 - \u05E9\u05DD \u05DE\u05DC\u05D0, \u05EA.\u05D6., \u05EA\u05D0\u05E8\u05D9\u05DA \u05DC\u05D9\u05D3\u05D4, \u05D7\u05EA\u05D9\u05DE\u05D4 \u05D3\u05D9\u05D2\u05D9\u05D8\u05DC\u05D9\u05EA';
    displayName: 'Charter Signature';
    pluralName: 'charter-signatures';
    singularName: 'charter-signature';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    birthDate: Schema.Attribute.Date & Schema.Attribute.Required;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    fullName: Schema.Attribute.String & Schema.Attribute.Required;
    idNumber: Schema.Attribute.String & Schema.Attribute.Required;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::charter-signature.charter-signature'
    > &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    signature: Schema.Attribute.Text & Schema.Attribute.Required;
    signedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiCityCity extends Struct.CollectionTypeSchema {
  collectionName: 'cities';
  info: {
    displayName: 'City';
    pluralName: 'cities';
    singularName: 'city';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<'oneToMany', 'api::city.city'> &
      Schema.Attribute.Private;
    name: Schema.Attribute.String;
    neighborhoods: Schema.Attribute.JSON;
    publishedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiCommunityFundCommunityFund
  extends Struct.CollectionTypeSchema {
  collectionName: 'community_funds';
  info: {
    displayName: 'CommunityFund';
    pluralName: 'community-funds';
    singularName: 'community-fund';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    amount: Schema.Attribute.Decimal;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::community-fund.community-fund'
    > &
      Schema.Attribute.Private;
    note: Schema.Attribute.Text;
    publishedAt: Schema.Attribute.DateTime;
    source: Schema.Attribute.Enumeration<['donation', 'order']>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiCommunityUserCommunityUser
  extends Struct.CollectionTypeSchema {
  collectionName: 'community_users';
  info: {
    displayName: 'community-user';
    pluralName: 'community-users';
    singularName: 'community-user';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    avatar_url: Schema.Attribute.Text;
    balance: Schema.Attribute.Decimal;
    banned: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    birth_date: Schema.Attribute.String;
    business: Schema.Attribute.String;
    city: Schema.Attribute.String;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    email: Schema.Attribute.Email;
    external_id: Schema.Attribute.String & Schema.Attribute.Unique;
    family_status: Schema.Attribute.String;
    gender: Schema.Attribute.String;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::community-user.community-user'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String;
    neighborhood: Schema.Attribute.String;
    nickname: Schema.Attribute.String;
    notifications: Schema.Attribute.Boolean;
    password_hash: Schema.Attribute.String;
    phone: Schema.Attribute.String;
    provider: Schema.Attribute.String;
    publishedAt: Schema.Attribute.DateTime;
    role: Schema.Attribute.Enumeration<
      ['user', 'neighborhood_admin', 'super_admin']
    > &
      Schema.Attribute.DefaultTo<'user'>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiCoordinatorRequestCoordinatorRequest
  extends Struct.CollectionTypeSchema {
  collectionName: 'coordinator_requests';
  info: {
    description: '\u05D1\u05E7\u05E9\u05D5\u05EA \u05DC\u05D4\u05E6\u05D8\u05E8\u05E4\u05D5\u05EA \u05DB\u05E8\u05DB\u05D6\u05D9 \u05E9\u05DB\u05D5\u05E0\u05D5\u05EA - \u05DE\u05D8\u05D5\u05E4\u05DC\u05D5\u05EA \u05E2"\u05D9 \u05E1\u05D5\u05E4\u05E8-\u05D0\u05D3\u05DE\u05D9\u05DF';
    displayName: 'Coordinator Request';
    pluralName: 'coordinator-requests';
    singularName: 'coordinator-request';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    decided_at: Schema.Attribute.DateTime;
    decided_by: Schema.Attribute.String;
    experience: Schema.Attribute.Text;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::coordinator-request.coordinator-request'
    > &
      Schema.Attribute.Private;
    motivation: Schema.Attribute.Text;
    name: Schema.Attribute.String & Schema.Attribute.Required;
    neighborhoods: Schema.Attribute.Text;
    phone: Schema.Attribute.String & Schema.Attribute.Required;
    publishedAt: Schema.Attribute.DateTime;
    rejection_reason: Schema.Attribute.Text;
    status: Schema.Attribute.Enumeration<['pending', 'approved', 'rejected']> &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'pending'>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    user_id: Schema.Attribute.String & Schema.Attribute.Required;
  };
}

export interface ApiEventEvent extends Struct.CollectionTypeSchema {
  collectionName: 'events';
  info: {
    displayName: 'Event';
    pluralName: 'events';
    singularName: 'event';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    city: Schema.Attribute.String;
    color: Schema.Attribute.String & Schema.Attribute.DefaultTo<'blue'>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    creator_id: Schema.Attribute.String;
    date: Schema.Attribute.Date & Schema.Attribute.Required;
    description: Schema.Attribute.Text;
    icon: Schema.Attribute.String & Schema.Attribute.DefaultTo<'\uD83D\uDCC5'>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<'oneToMany', 'api::event.event'> &
      Schema.Attribute.Private;
    location: Schema.Attribute.String;
    neighborhood: Schema.Attribute.String;
    price: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<0>;
    price_description: Schema.Attribute.String;
    publishedAt: Schema.Attribute.DateTime;
    status: Schema.Attribute.Enumeration<['pending', 'approved', 'rejected']> &
      Schema.Attribute.DefaultTo<'pending'>;
    submitted_by_id: Schema.Attribute.String;
    time: Schema.Attribute.String;
    title: Schema.Attribute.String & Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiItemItem extends Struct.CollectionTypeSchema {
  collectionName: 'items';
  info: {
    displayName: 'Item';
    pluralName: 'items';
    singularName: 'item';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    address: Schema.Attribute.String;
    category: Schema.Attribute.Enumeration<
      [
        'gemachim',
        'giveaway',
        'business',
        'minyanim',
        'education',
        'realestate',
        'security',
        'shops',
        'restaurants',
        'rides',
        'jobs',
        'singles',
        'events',
        'for_kids',
        'attractions',
        'safe-space',
        'category ',
        'lost_and_found',
        'message',
        'raise_hand',
      ]
    >;
    city: Schema.Attribute.String;
    color: Schema.Attribute.String;
    contact: Schema.Attribute.String;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    description: Schema.Attribute.Text;
    extra_fields: Schema.Attribute.JSON;
    icon: Schema.Attribute.String;
    label: Schema.Attribute.Text;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<'oneToMany', 'api::item.item'> &
      Schema.Attribute.Private;
    neighborhood: Schema.Attribute.String;
    phone: Schema.Attribute.String;
    publishedAt: Schema.Attribute.DateTime;
    status1: Schema.Attribute.Enumeration<
      ['active', 'inactive', 'deleted', 'resolved']
    >;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    user: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    user_id: Schema.Attribute.String;
    view_count: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<0>;
  };
}

export interface ApiLostFoundRequestLostFoundRequest
  extends Struct.CollectionTypeSchema {
  collectionName: 'lost_found_requests';
  info: {
    displayName: 'LostFoundRequest';
    pluralName: 'lost-found-requests';
    singularName: 'lost-found-request';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    contact_phone: Schema.Attribute.String;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    description: Schema.Attribute.Text;
    item7_status: Schema.Attribute.Enumeration<['open', 'resolved']>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::lost-found-request.lost-found-request'
    > &
      Schema.Attribute.Private;
    neighborhood: Schema.Attribute.String;
    publishedAt: Schema.Attribute.DateTime;
    type: Schema.Attribute.Enumeration<
      ['lost_child', 'lost_dog', 'elderly_help', 'car_help', 'other']
    >;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiNewsTickerItemNewsTickerItem
  extends Struct.CollectionTypeSchema {
  collectionName: 'news_ticker_items';
  info: {
    displayName: 'NewsTickerItem';
    pluralName: 'news-ticker-items';
    singularName: 'news-ticker-item';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    active: Schema.Attribute.Boolean;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    locale2: Schema.Attribute.String;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::news-ticker-item.news-ticker-item'
    > &
      Schema.Attribute.Private;
    order: Schema.Attribute.Integer;
    publishedAt: Schema.Attribute.DateTime;
    text: Schema.Attribute.String;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiPgCampaignPgCampaign extends Struct.CollectionTypeSchema {
  collectionName: 'pg_campaigns';
  info: {
    description: '\u05E7\u05DE\u05E4\u05D9\u05D9\u05DF \u05E8\u05DB\u05D9\u05E9\u05D5\u05EA \u05E7\u05D1\u05D5\u05E6\u05EA\u05D9\u05D5\u05EA - \u05EA\u05D5\u05DB\u05DF \u05D5\u05DE\u05D1\u05E0\u05D4 \u05D1\u05DC\u05D1\u05D3. \u05E0\u05EA\u05D5\u05E0\u05D9 \u05D7\u05D1\u05E8\u05D9\u05DD/\u05D7\u05D9\u05E1\u05DB\u05D5\u05DF \u05DE\u05D2\u05D9\u05E2\u05D9\u05DD \u05DE-Google Sheet, \u05DC\u05D0 \u05DE\u05DB\u05D0\u05DF.';
    displayName: 'PG \u00B7 Campaign';
    pluralName: 'pg-campaigns';
    singularName: 'pg-campaign';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    benefits: Schema.Attribute.JSON;
    can_join: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    description: Schema.Attribute.Text;
    faq_override: Schema.Attribute.JSON;
    find_section: Schema.Attribute.JSON;
    icon: Schema.Attribute.String;
    image_url: Schema.Attribute.String;
    is_new: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    join_cta_subtitle: Schema.Attribute.Text;
    join_link: Schema.Attribute.String;
    join_link_diesel: Schema.Attribute.String;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::pg-campaign.pg-campaign'
    > &
      Schema.Attribute.Private;
    new_badge_text: Schema.Attribute.String;
    order: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<100>;
    plans_table: Schema.Attribute.JSON;
    plans_table_diesel: Schema.Attribute.JSON;
    plans_table_diesel_note: Schema.Attribute.Text;
    plans_table_note: Schema.Attribute.Text;
    providers_line: Schema.Attribute.String;
    publishedAt: Schema.Attribute.DateTime;
    rating_companies: Schema.Attribute.JSON;
    slug: Schema.Attribute.UID<'title'> & Schema.Attribute.Required;
    status: Schema.Attribute.Enumeration<['active', 'soon', 'inactive']> &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'soon'>;
    steps_override: Schema.Attribute.JSON;
    title: Schema.Attribute.String & Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiPgSatisfactionResponsePgSatisfactionResponse
  extends Struct.CollectionTypeSchema {
  collectionName: 'pg_satisfaction_responses';
  info: {
    description: '\u05EA\u05D2\u05D5\u05D1\u05D5\u05EA \u05E1\u05E7\u05E8 \u05E9\u05D1\u05D9\u05E2\u05D5\u05EA \u05E8\u05E6\u05D5\u05DF \u05E9\u05DC \u05D7\u05D1\u05E8\u05D9 \u05E7\u05D1\u05D5\u05E6\u05D5\u05EA \u05D4\u05E8\u05DB\u05D9\u05E9\u05D5\u05EA';
    displayName: 'PG \u00B7 Satisfaction Response';
    pluralName: 'pg-satisfaction-responses';
    singularName: 'pg-satisfaction-response';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    admin_liked: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    admin_reply: Schema.Attribute.Text;
    campaign_slug: Schema.Attribute.String & Schema.Attribute.Required;
    comments: Schema.Attribute.Text;
    company: Schema.Attribute.String;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    improvements: Schema.Attribute.Text;
    is_featured: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    level: Schema.Attribute.Integer &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMax<
        {
          max: 5;
          min: 1;
        },
        number
      >;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::pg-satisfaction-response.pg-satisfaction-response'
    > &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    submitted_at: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    user_city: Schema.Attribute.String;
    user_id: Schema.Attribute.String;
    user_name: Schema.Attribute.String;
    user_phone: Schema.Attribute.String;
  };
}

export interface ApiPostPost extends Struct.CollectionTypeSchema {
  collectionName: 'posts';
  info: {
    description: '\u05E4\u05D5\u05E1\u05D8\u05D9\u05DD/\u05D7\u05D3\u05E9\u05D5\u05EA \u05E7\u05D4\u05D9\u05DC\u05EA\u05D9\u05D9\u05DD - \u05DE\u05D5\u05E6\u05D2\u05D9\u05DD \u05D1-NewsTicker \u05D5\u05DE\u05D5\u05E4\u05E6\u05D9\u05DD \u05D3\u05E8\u05DA /api/community-news';
    displayName: 'Post';
    pluralName: 'posts';
    singularName: 'post';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    archived: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    category: Schema.Attribute.String;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    imageUrl: Schema.Attribute.Media<'images'>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<'oneToMany', 'api::post.post'> &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    sourceUrl: Schema.Attribute.String;
    summary: Schema.Attribute.Text;
    title: Schema.Attribute.String & Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiProfileProfile extends Struct.CollectionTypeSchema {
  collectionName: 'profiles';
  info: {
    displayName: 'profile';
    pluralName: 'profiles';
    singularName: 'profile';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    avatar_url: Schema.Attribute.Text;
    business: Schema.Attribute.String;
    city: Schema.Attribute.String;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    family_status: Schema.Attribute.String;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::profile.profile'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String;
    neighborhood: Schema.Attribute.String;
    nickname: Schema.Attribute.String;
    notifications: Schema.Attribute.Integer;
    phone: Schema.Attribute.String;
    publishedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    user_id: Schema.Attribute.String;
  };
}

export interface ApiPushSubscriptionPushSubscription
  extends Struct.CollectionTypeSchema {
  collectionName: 'push_subscriptions';
  info: {
    description: 'Web Push notification subscriptions';
    displayName: 'Push Subscription';
    pluralName: 'push-subscriptions';
    singularName: 'push-subscription';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    auth: Schema.Attribute.Text & Schema.Attribute.Required;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    endpoint: Schema.Attribute.Text & Schema.Attribute.Required;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::push-subscription.push-subscription'
    > &
      Schema.Attribute.Private;
    p256dh: Schema.Attribute.Text & Schema.Attribute.Required;
    publishedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    user_agent: Schema.Attribute.String;
    user_id: Schema.Attribute.String;
  };
}

export interface ApiRevenueConfigRevenueConfig extends Struct.SingleTypeSchema {
  collectionName: 'revenue_config';
  info: {
    displayName: 'Revenue Config';
    pluralName: 'revenue-configs';
    singularName: 'revenue-config';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    channels: Schema.Attribute.JSON;
    costs: Schema.Attribute.JSON;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    distribution: Schema.Attribute.JSON;
    flow_nodes: Schema.Attribute.JSON;
    hero_subtitle: Schema.Attribute.Text &
      Schema.Attribute.DefaultTo<'\u05DE\u05D5\u05D3\u05DC \u05E9\u05E7\u05D5\u05E3 \u05E9\u05D1\u05D5 \u05DB\u05DC \u05E9\u05E7\u05DC \u05E9\u05E0\u05DB\u05E0\u05E1 \u05DE\u05EA\u05D7\u05DC\u05E7 \u05D1\u05D9\u05DF \u05D1\u05E2\u05DC\u05D9\u05DD, \u05E6\u05D3\u05E7\u05D4 \u05D5\u05E8\u05DB\u05D6\u05D9\u05DD - \u05D5\u05DB\u05D5\u05DC\u05DD \u05DE\u05E8\u05D5\u05D5\u05D9\u05D7\u05D9\u05DD \u05D9\u05D7\u05D3 \u05E2\u05DD \u05D4\u05E7\u05D4\u05D9\u05DC\u05D4.'>;
    hero_title: Schema.Attribute.String &
      Schema.Attribute.DefaultTo<'\u05D0\u05D9\u05DA \u05D4\u05E7\u05D4\u05D9\u05DC\u05D4 \u05DE\u05D9\u05D9\u05E6\u05E8\u05EA \u05E2\u05E8\u05DA - \u05D5\u05DE\u05D7\u05D6\u05D9\u05E8\u05D4 \u05D0\u05D5\u05EA\u05D5 \u05DC\u05D7\u05D1\u05E8\u05D9\u05DD'>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::revenue-config.revenue-config'
    > &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    stats: Schema.Attribute.JSON;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiSubmittedAdSubmittedAd extends Struct.CollectionTypeSchema {
  collectionName: 'submitted_ads';
  info: {
    description: '\u05E4\u05E8\u05E1\u05D5\u05DE\u05D5\u05EA \u05E9\u05DE\u05E9\u05EA\u05DE\u05E9\u05D9\u05DD \u05E9\u05DC\u05D7\u05D5 \u05DC\u05D0\u05D9\u05E9\u05D5\u05E8 - pending / approved / rejected';
    displayName: 'Submitted Ad';
    pluralName: 'submitted-ads';
    singularName: 'submitted-ad';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    ad_status: Schema.Attribute.Enumeration<
      ['pending', 'approved', 'rejected']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'pending'>;
    company_name: Schema.Attribute.String;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    cta: Schema.Attribute.String;
    decided_at: Schema.Attribute.DateTime;
    decided_by: Schema.Attribute.String;
    duration_days: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<30>;
    expires_at: Schema.Attribute.DateTime;
    gradient: Schema.Attribute.String;
    hover_text: Schema.Attribute.Text;
    landing: Schema.Attribute.JSON;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::submitted-ad.submitted-ad'
    > &
      Schema.Attribute.Private;
    logo: Schema.Attribute.Text;
    main_image: Schema.Attribute.Text;
    payment_amount: Schema.Attribute.Decimal;
    publishedAt: Schema.Attribute.DateTime;
    rejection_reason: Schema.Attribute.Text;
    reminders_sent: Schema.Attribute.JSON;
    submitted_at: Schema.Attribute.DateTime;
    submitted_by_email: Schema.Attribute.String;
    submitted_by_id: Schema.Attribute.String;
    submitted_by_name: Schema.Attribute.String;
    subtitle: Schema.Attribute.Text;
    title: Schema.Attribute.String & Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface PluginContentReleasesRelease
  extends Struct.CollectionTypeSchema {
  collectionName: 'strapi_releases';
  info: {
    displayName: 'Release';
    pluralName: 'releases';
    singularName: 'release';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    actions: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::content-releases.release-action'
    >;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::content-releases.release'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String & Schema.Attribute.Required;
    publishedAt: Schema.Attribute.DateTime;
    releasedAt: Schema.Attribute.DateTime;
    scheduledAt: Schema.Attribute.DateTime;
    status: Schema.Attribute.Enumeration<
      ['ready', 'blocked', 'failed', 'done', 'empty']
    > &
      Schema.Attribute.Required;
    timezone: Schema.Attribute.String;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface PluginContentReleasesReleaseAction
  extends Struct.CollectionTypeSchema {
  collectionName: 'strapi_release_actions';
  info: {
    displayName: 'Release Action';
    pluralName: 'release-actions';
    singularName: 'release-action';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    contentType: Schema.Attribute.String & Schema.Attribute.Required;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    entryDocumentId: Schema.Attribute.String;
    isEntryValid: Schema.Attribute.Boolean;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::content-releases.release-action'
    > &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    release: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::content-releases.release'
    >;
    type: Schema.Attribute.Enumeration<['publish', 'unpublish']> &
      Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface PluginI18NLocale extends Struct.CollectionTypeSchema {
  collectionName: 'i18n_locale';
  info: {
    collectionName: 'locales';
    description: '';
    displayName: 'Locale';
    pluralName: 'locales';
    singularName: 'locale';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    code: Schema.Attribute.String & Schema.Attribute.Unique;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::i18n.locale'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String &
      Schema.Attribute.SetMinMax<
        {
          max: 50;
          min: 1;
        },
        number
      >;
    publishedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface PluginReviewWorkflowsWorkflow
  extends Struct.CollectionTypeSchema {
  collectionName: 'strapi_workflows';
  info: {
    description: '';
    displayName: 'Workflow';
    name: 'Workflow';
    pluralName: 'workflows';
    singularName: 'workflow';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    contentTypes: Schema.Attribute.JSON &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'[]'>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::review-workflows.workflow'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique;
    publishedAt: Schema.Attribute.DateTime;
    stageRequiredToPublish: Schema.Attribute.Relation<
      'oneToOne',
      'plugin::review-workflows.workflow-stage'
    >;
    stages: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::review-workflows.workflow-stage'
    >;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface PluginReviewWorkflowsWorkflowStage
  extends Struct.CollectionTypeSchema {
  collectionName: 'strapi_workflows_stages';
  info: {
    description: '';
    displayName: 'Stages';
    name: 'Workflow Stage';
    pluralName: 'workflow-stages';
    singularName: 'workflow-stage';
  };
  options: {
    draftAndPublish: false;
    version: '1.1.0';
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    color: Schema.Attribute.String & Schema.Attribute.DefaultTo<'#4945FF'>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::review-workflows.workflow-stage'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String;
    permissions: Schema.Attribute.Relation<'manyToMany', 'admin::permission'>;
    publishedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    workflow: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::review-workflows.workflow'
    >;
  };
}

export interface PluginUploadFile extends Struct.CollectionTypeSchema {
  collectionName: 'files';
  info: {
    description: '';
    displayName: 'File';
    pluralName: 'files';
    singularName: 'file';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    alternativeText: Schema.Attribute.Text;
    caption: Schema.Attribute.Text;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    ext: Schema.Attribute.String;
    focalPoint: Schema.Attribute.JSON;
    folder: Schema.Attribute.Relation<'manyToOne', 'plugin::upload.folder'> &
      Schema.Attribute.Private;
    folderPath: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Private &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    formats: Schema.Attribute.JSON;
    hash: Schema.Attribute.String & Schema.Attribute.Required;
    height: Schema.Attribute.Integer;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::upload.file'
    > &
      Schema.Attribute.Private;
    mime: Schema.Attribute.String & Schema.Attribute.Required;
    name: Schema.Attribute.String & Schema.Attribute.Required;
    previewUrl: Schema.Attribute.Text;
    provider: Schema.Attribute.String & Schema.Attribute.Required;
    provider_metadata: Schema.Attribute.JSON;
    publishedAt: Schema.Attribute.DateTime;
    related: Schema.Attribute.Relation<'morphToMany'>;
    size: Schema.Attribute.Decimal & Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    url: Schema.Attribute.Text & Schema.Attribute.Required;
    width: Schema.Attribute.Integer;
  };
}

export interface PluginUploadFolder extends Struct.CollectionTypeSchema {
  collectionName: 'upload_folders';
  info: {
    displayName: 'Folder';
    pluralName: 'folders';
    singularName: 'folder';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    children: Schema.Attribute.Relation<'oneToMany', 'plugin::upload.folder'>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    files: Schema.Attribute.Relation<'oneToMany', 'plugin::upload.file'>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::upload.folder'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    parent: Schema.Attribute.Relation<'manyToOne', 'plugin::upload.folder'>;
    path: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    pathId: Schema.Attribute.Integer &
      Schema.Attribute.Required &
      Schema.Attribute.Unique;
    publishedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface PluginUsersPermissionsPermission
  extends Struct.CollectionTypeSchema {
  collectionName: 'up_permissions';
  info: {
    description: '';
    displayName: 'Permission';
    name: 'permission';
    pluralName: 'permissions';
    singularName: 'permission';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    action: Schema.Attribute.String & Schema.Attribute.Required;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::users-permissions.permission'
    > &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    role: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.role'
    >;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface PluginUsersPermissionsRole
  extends Struct.CollectionTypeSchema {
  collectionName: 'up_roles';
  info: {
    description: '';
    displayName: 'Role';
    name: 'role';
    pluralName: 'roles';
    singularName: 'role';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    description: Schema.Attribute.String;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::users-permissions.role'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 3;
      }>;
    permissions: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::users-permissions.permission'
    >;
    publishedAt: Schema.Attribute.DateTime;
    type: Schema.Attribute.String & Schema.Attribute.Unique;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    users: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::users-permissions.user'
    >;
  };
}

export interface PluginUsersPermissionsUser
  extends Struct.CollectionTypeSchema {
  collectionName: 'up_users';
  info: {
    description: '';
    displayName: 'User';
    name: 'user';
    pluralName: 'users';
    singularName: 'user';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    app_role: Schema.Attribute.String & Schema.Attribute.DefaultTo<'user'>;
    avatar_url: Schema.Attribute.Text;
    balance: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<0>;
    birth_date: Schema.Attribute.String;
    blocked: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    business: Schema.Attribute.String;
    city: Schema.Attribute.String;
    confirmationToken: Schema.Attribute.String & Schema.Attribute.Private;
    confirmed: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    coordinator_of: Schema.Attribute.JSON & Schema.Attribute.DefaultTo<[]>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    email: Schema.Attribute.Email &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 6;
      }>;
    external_id: Schema.Attribute.String;
    family_status: Schema.Attribute.String;
    gender: Schema.Attribute.String;
    items: Schema.Attribute.Relation<'oneToMany', 'api::item.item'>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::users-permissions.user'
    > &
      Schema.Attribute.Private;
    neighborhood: Schema.Attribute.String;
    nickname: Schema.Attribute.String;
    notifications: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    password: Schema.Attribute.Password &
      Schema.Attribute.Private &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 6;
      }>;
    phone: Schema.Attribute.String;
    provider: Schema.Attribute.String;
    publishedAt: Schema.Attribute.DateTime;
    resetPasswordToken: Schema.Attribute.String & Schema.Attribute.Private;
    role: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.role'
    >;
    security_answer: Schema.Attribute.String;
    security_answer_2: Schema.Attribute.String;
    security_question: Schema.Attribute.String;
    security_question_2: Schema.Attribute.String;
    status: Schema.Attribute.String & Schema.Attribute.DefaultTo<'active'>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    username: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 3;
      }>;
  };
}

declare module '@strapi/strapi' {
  export module Public {
    export interface ContentTypeSchemas {
      'admin::api-token': AdminApiToken;
      'admin::api-token-permission': AdminApiTokenPermission;
      'admin::permission': AdminPermission;
      'admin::role': AdminRole;
      'admin::session': AdminSession;
      'admin::transfer-token': AdminTransferToken;
      'admin::transfer-token-permission': AdminTransferTokenPermission;
      'admin::user': AdminUser;
      'api::advertisement-order.advertisement-order': ApiAdvertisementOrderAdvertisementOrder;
      'api::advertisement.advertisement': ApiAdvertisementAdvertisement;
      'api::ch-activity-item.ch-activity-item': ApiChActivityItemChActivityItem;
      'api::ch-article.ch-article': ApiChArticleChArticle;
      'api::ch-charter-signature.ch-charter-signature': ApiChCharterSignatureChCharterSignature;
      'api::ch-hearing-request.ch-hearing-request': ApiChHearingRequestChHearingRequest;
      'api::ch-hearing.ch-hearing': ApiChHearingChHearing;
      'api::ch-home-config.ch-home-config': ApiChHomeConfigChHomeConfig;
      'api::ch-news-item.ch-news-item': ApiChNewsItemChNewsItem;
      'api::ch-qa-item.ch-qa-item': ApiChQaItemChQaItem;
      'api::ch-question-submission.ch-question-submission': ApiChQuestionSubmissionChQuestionSubmission;
      'api::ch-rabbi.ch-rabbi': ApiChRabbiChRabbi;
      'api::ch-ruling.ch-ruling': ApiChRulingChRuling;
      'api::charter-signature.charter-signature': ApiCharterSignatureCharterSignature;
      'api::city.city': ApiCityCity;
      'api::community-fund.community-fund': ApiCommunityFundCommunityFund;
      'api::community-user.community-user': ApiCommunityUserCommunityUser;
      'api::coordinator-request.coordinator-request': ApiCoordinatorRequestCoordinatorRequest;
      'api::event.event': ApiEventEvent;
      'api::item.item': ApiItemItem;
      'api::lost-found-request.lost-found-request': ApiLostFoundRequestLostFoundRequest;
      'api::news-ticker-item.news-ticker-item': ApiNewsTickerItemNewsTickerItem;
      'api::pg-campaign.pg-campaign': ApiPgCampaignPgCampaign;
      'api::pg-satisfaction-response.pg-satisfaction-response': ApiPgSatisfactionResponsePgSatisfactionResponse;
      'api::post.post': ApiPostPost;
      'api::profile.profile': ApiProfileProfile;
      'api::push-subscription.push-subscription': ApiPushSubscriptionPushSubscription;
      'api::revenue-config.revenue-config': ApiRevenueConfigRevenueConfig;
      'api::submitted-ad.submitted-ad': ApiSubmittedAdSubmittedAd;
      'plugin::content-releases.release': PluginContentReleasesRelease;
      'plugin::content-releases.release-action': PluginContentReleasesReleaseAction;
      'plugin::i18n.locale': PluginI18NLocale;
      'plugin::review-workflows.workflow': PluginReviewWorkflowsWorkflow;
      'plugin::review-workflows.workflow-stage': PluginReviewWorkflowsWorkflowStage;
      'plugin::upload.file': PluginUploadFile;
      'plugin::upload.folder': PluginUploadFolder;
      'plugin::users-permissions.permission': PluginUsersPermissionsPermission;
      'plugin::users-permissions.role': PluginUsersPermissionsRole;
      'plugin::users-permissions.user': PluginUsersPermissionsUser;
    }
  }
}
