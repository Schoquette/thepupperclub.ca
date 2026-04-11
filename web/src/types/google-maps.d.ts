declare namespace google.maps {
  namespace places {
    class Autocomplete {
      constructor(input: HTMLInputElement, opts?: AutocompleteOptions);
      addListener(event: string, handler: () => void): void;
      getPlace(): PlaceResult;
    }

    interface AutocompleteOptions {
      componentRestrictions?: { country: string | string[] };
      types?: string[];
      fields?: string[];
    }

    interface PlaceResult {
      address_components?: AddressComponent[];
      formatted_address?: string;
    }

    interface AddressComponent {
      long_name: string;
      short_name: string;
      types: string[];
    }
  }
}
