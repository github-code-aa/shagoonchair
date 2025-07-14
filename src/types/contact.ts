export interface ContactData {
  page: {
    title: string;
    description: string;
  };
  hero: {
    title: string;
    description: string;
  };
  contactInfo: {
    title: string;
    subtitle: string;
    items: Array<{
      icon: string;
      title: string;
      details: Array<{
        label: string;
        value: string;
      }>;
    }>;
  };
  contactForm: {
    isVisible:boolean;
    title: string;
    subtitle: string;
    fields: Array<{
      name: string;
      label: string;
      type: 'text' | 'email' | 'tel' | 'select' | 'textarea';
      placeholder?: string;
      required: boolean;
      rows?: number;
      options?: string[];
    }>;
    submitText: string;
  };
  map: {
    title: string;
    subtitle: string;
    embedUrl: string;
    businessName: string;
    address: string;
    details: Array<{
      icon: string;
      title: string;
      info: string;
    }>;
  };
  faqs: {
    title: string;
    subtitle: string;
    items: Array<{
      question: string;
      answer: string;
    }>;
  };
}
