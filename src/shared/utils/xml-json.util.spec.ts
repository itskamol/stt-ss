import { XmlJsonUtil } from './xml-json.util';

describe('XmlJsonUtil', () => {
    const sampleXml = `<?xml version="1.0" encoding="UTF-8"?>
<person id="123" active="true">
    <name>John Doe</name>
    <age>30</age>
    <address>
        <street>123 Main St</street>
        <city>New York</city>
        <country>USA</country>
    </address>
    <hobbies>
        <hobby>reading</hobby>
        <hobby>swimming</hobby>
    </hobbies>
</person>`;

    const sampleJson = {
        id: '123',
        active: 'true',
        name: 'John Doe',
        age: '30',
        address: {
            street: '123 Main St',
            city: 'New York',
            country: 'USA'
        },
        hobbies: {
            hobby: ['reading', 'swimming']
        }
    };

    describe('xmlToJson', () => {
        it('should convert XML to JSON successfully', async () => {
            const result = await XmlJsonUtil.xmlToJson(sampleXml);
            
            expect(result).toBeDefined();
            expect(result.person).toBeDefined();
            expect(result.person.name).toBe('John Doe');
            expect(result.person['@'].id).toBe('123');
        });

        it('should handle XML with merged attributes', async () => {
            const result = await XmlJsonUtil.xmlToJsonWithMergedAttrs(sampleXml);
            
            expect(result.person.id).toBe('123');
            expect(result.person.active).toBe('true');
            expect(result.person.name).toBe('John Doe');
        });

        it('should convert XML to flat JSON', async () => {
            const simpleXml = '<root><name>Test</name></root>';
            const result = await XmlJsonUtil.xmlToJsonFlat(simpleXml);
            
            expect(result.name).toBe('Test');
        });

        it('should handle invalid XML gracefully', async () => {
            const invalidXml = '<invalid><unclosed>';
            
            await expect(XmlJsonUtil.xmlToJson(invalidXml)).rejects.toThrow();
        });

        it('should clean JSON from XML artifacts', async () => {
            const xmlWithEmpty = '<root><name>Test</name><empty></empty></root>';
            const result = await XmlJsonUtil.xmlToJsonClean(xmlWithEmpty);
            
            expect(result.name).toBe('Test');
            expect(result.empty).toBeUndefined();
        });
    });

    describe('jsonToXml', () => {
        it('should convert JSON to XML successfully', () => {
            const result = XmlJsonUtil.jsonToXml(sampleJson, 'person');
            
            expect(result).toContain('<?xml version="1.0" encoding="UTF-8"?>');
            expect(result).toContain('<person>');
            expect(result).toContain('<name>John Doe</name>');
            expect(result).toContain('</person>');
        });

        it('should convert JSON to XML without declaration', () => {
            const result = XmlJsonUtil.jsonToXmlNoDeclaration(sampleJson, 'person');
            
            expect(result).not.toContain('<?xml');
            expect(result).toContain('<person>');
            expect(result).toContain('<name>John Doe</name>');
        });

        it('should convert JSON to pretty XML', () => {
            const result = XmlJsonUtil.jsonToXmlPretty(sampleJson, 'person', true);
            
            expect(result).toContain('\n');
            expect(result).toContain('  '); // Indentation
        });

        it('should convert JSON to compact XML', () => {
            const result = XmlJsonUtil.jsonToXmlPretty(sampleJson, 'person', false);
            
            expect(result).not.toContain('\n  ');
        });

        it('should handle JSON with CDATA', () => {
            const jsonWithSpecialChars = {
                description: '<script>alert("test")</script>'
            };
            
            const result = XmlJsonUtil.jsonToXmlWithCDATA(jsonWithSpecialChars, 'data');
            
            // Check that XML is generated and contains the description
            expect(result).toContain('<description>');
            expect(result).toContain('alert');
            expect(typeof result).toBe('string');
        });
    });

    describe('validation methods', () => {
        it('should validate valid XML', () => {
            const validXml = '<root><name>Test</name></root>';
            expect(XmlJsonUtil.isValidXml(validXml)).toBe(true);
        });

        it('should reject invalid XML', () => {
            const invalidXml = '<root><unclosed>';
            expect(XmlJsonUtil.isValidXml(invalidXml)).toBe(false);
        });

        it('should validate JSON for XML conversion', () => {
            const validJson = { name: 'Test', age: 25 };
            expect(XmlJsonUtil.isValidJsonForXml(validJson)).toBe(true);
        });

        it('should reject null/undefined for XML conversion', () => {
            expect(XmlJsonUtil.isValidJsonForXml(null)).toBe(false);
            expect(XmlJsonUtil.isValidJsonForXml(undefined)).toBe(false);
        });

        it('should reject circular references', () => {
            const circularJson: any = { name: 'Test' };
            circularJson.self = circularJson;
            
            expect(XmlJsonUtil.isValidJsonForXml(circularJson)).toBe(false);
        });
    });

    describe('convert method', () => {
        it('should convert XML to JSON using generic method', async () => {
            const result = await XmlJsonUtil.convert(sampleXml, 'json');
            
            expect(result).toBeDefined();
            expect(result.person).toBeDefined();
        });

        it('should convert JSON to XML using generic method', async () => {
            const result = await XmlJsonUtil.convert(sampleJson, 'xml', 'person');
            
            expect(typeof result).toBe('string');
            expect(result).toContain('<person>');
        });

        it('should handle conversion errors gracefully', async () => {
            await expect(
                XmlJsonUtil.convert({}, 'json')
            ).rejects.toThrow('Input must be a string for XML to JSON conversion');
            
            await expect(
                XmlJsonUtil.convert('test', 'xml')
            ).rejects.toThrow('Input must be an object for JSON to XML conversion');
        });
    });

    describe('custom attribute handling', () => {
        it('should handle custom attribute prefix', async () => {
            const xmlWithAttrs = '<person id="123"><name>John</name></person>';
            const result = await XmlJsonUtil.xmlToJsonCustom(xmlWithAttrs, '$', 'text');
            
            expect(result.person['$'].id).toBe('123');
        });
    });

    describe('real-world scenarios', () => {
        it('should handle complex nested XML', async () => {
            const complexXml = `
                <catalog>
                    <book id="1" category="fiction">
                        <title>The Great Gatsby</title>
                        <author>F. Scott Fitzgerald</author>
                        <price currency="USD">12.99</price>
                    </book>
                    <book id="2" category="non-fiction">
                        <title>Sapiens</title>
                        <author>Yuval Noah Harari</author>
                        <price currency="USD">15.99</price>
                    </book>
                </catalog>
            `;
            
            const result = await XmlJsonUtil.xmlToJson(complexXml);
            
            expect(result.catalog.book).toBeDefined();
            expect(Array.isArray(result.catalog.book)).toBe(true);
            expect(result.catalog.book).toHaveLength(2);
        });

        it('should handle XML with namespaces', async () => {
            const xmlWithNamespace = `
                <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
                    <soap:Body>
                        <m:GetPrice xmlns:m="http://www.example.org/stock">
                            <m:Item>Apple</m:Item>
                        </m:GetPrice>
                    </soap:Body>
                </soap:Envelope>
            `;
            
            const result = await XmlJsonUtil.xmlToJson(xmlWithNamespace);
            
            expect(result['soap:Envelope']).toBeDefined();
            expect(result['soap:Envelope']['soap:Body']).toBeDefined();
        });

        it('should convert API response format', async () => {
            const apiResponse = {
                status: 'success',
                data: {
                    users: [
                        { id: 1, name: 'John', email: 'john@example.com' },
                        { id: 2, name: 'Jane', email: 'jane@example.com' }
                    ]
                },
                meta: {
                    total: 2,
                    page: 1
                }
            };
            
            const xml = XmlJsonUtil.jsonToXml(apiResponse, 'response');
            const backToJson = await XmlJsonUtil.xmlToJson(xml);
            
            expect(backToJson.response.status).toBe('success');
            expect(backToJson.response.data.users).toBeDefined();
        });
    });
});