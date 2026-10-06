import type { Schema, Struct } from '@strapi/strapi';

export interface ResponsesResponses extends Struct.ComponentSchema {
  collectionName: 'components_responses_responses';
  info: {
    description: '\u05DE\u05D1\u05E7\u05E8 \u05E8\u05E9\u05D5\u05D9\u05D5\u05EA \u05D4\u05DE\u05D3\u05D9\u05E0\u05D4 (criticism) \u2014 \u05EA\u05D2\u05D5\u05D1\u05D4 \u05DC\u05E4\u05E0\u05D9\u05D9\u05D4 (\u05E0\u05E6\u05D9\u05D2 \u05D0\u05D5 \u05D4\u05E0\u05D4\u05DC\u05EA \u05D4\u05D0\u05EA\u05E8)';
    displayName: 'responses';
  };
  attributes: {
    content: Schema.Attribute.Text & Schema.Attribute.Required;
    council_member: Schema.Attribute.Relation<
      'manyToOne',
      'api::concil-member.concil-member'
    >;
    createdDate: Schema.Attribute.DateTime;
    isOfficial: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
  };
}

declare module '@strapi/strapi' {
  export module Public {
    export interface ComponentSchemas {
      'responses.responses': ResponsesResponses;
    }
  }
}
