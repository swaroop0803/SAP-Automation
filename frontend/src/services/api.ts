import { TestCommand, TestResult, TestStep, ParsedCommand } from '../types';

// Mock API service - will be replaced with real backend calls later
class ApiService {
  private baseUrl = 'http://localhost:3001/api'; // Backend API URL (to be implemented)

  // Simulate parsing natural language command with AI
  async parseCommand(command: string): Promise<ParsedCommand> {
    // Simulate AI processing delay
    await this.delay(1000);

    // Mock parsing logic - in real implementation, this calls Claude/OpenAI API
    const lowerCommand = command.toLowerCase();

    if (lowerCommand.includes('purchase order') || lowerCommand.includes('po')) {
      return {
        action: 'create_purchase_order',
        parameters: this.extractPOParameters(command),
        confidence: 0.95,
      };
    } else if (lowerCommand.includes('goods receipt') || lowerCommand.includes('gr')) {
      return {
        action: 'post_goods_receipt',
        parameters: this.extractGRParameters(command),
        confidence: 0.92,
      };
    } else if (lowerCommand.includes('supplier invoice') || lowerCommand.includes('invoice')) {
      return {
        action: 'create_supplier_invoice',
        parameters: this.extractInvoiceParameters(command),
        confidence: 0.93,
      };
    } else if (lowerCommand.includes('procurement flow') || lowerCommand.includes('full flow')) {
      return {
        action: 'complete_procurement_flow',
        parameters: this.extractPOParameters(command),
        confidence: 0.90,
      };
    }

    return {
      action: 'unknown',
      parameters: {},
      confidence: 0.5,
    };
  }

  // Execute the test command
  async executeTest(
    command: string,
    onProgress?: (steps: TestStep[]) => void
  ): Promise<TestResult> {
    const startTime = Date.now();
    const steps: TestStep[] = [];

    try {
      // Parse the command first
      const parsed = await this.parseCommand(command);

      if (parsed.action === 'unknown') {
        throw new Error('Could not understand the command. Please try rephrasing.');
      }

      // Simulate test execution with multiple steps
      const testSteps = this.getTestSteps(parsed.action);

      for (let i = 0; i < testSteps.length; i++) {
        const step: TestStep = {
          id: `step-${i}`,
          description: testSteps[i],
          status: 'running',
          timestamp: new Date(),
        };

        steps.push(step);
        onProgress?.(steps);

        // Simulate step execution
        await this.delay(1500 + Math.random() * 1000);

        // Mark as completed
        steps[i].status = 'completed';
        onProgress?.(steps);
      }

      const duration = Date.now() - startTime;

      return {
        success: true,
        message: `Test completed successfully! Executed ${steps.length} steps.`,
        duration,
        steps,
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      return {
        success: false,
        message: 'Test execution failed',
        duration,
        steps,
        errors: [error instanceof Error ? error.message : 'Unknown error occurred'],
      };
    }
  }

  // Helper methods
  private extractPOParameters(command: string): Record<string, any> {
    const params: Record<string, any> = {};

    // Extract supplier
    const supplierMatch = command.match(/supplier\s+(\w+)/i);
    if (supplierMatch) params.supplier = supplierMatch[1];

    // Extract material
    const materialMatch = command.match(/material\s+([\w-]+)/i);
    if (materialMatch) params.material = materialMatch[1];

    // Extract quantity
    const quantityMatch = command.match(/quantity\s+(\d+)/i);
    if (quantityMatch) params.quantity = parseInt(quantityMatch[1]);

    // Extract price
    const priceMatch = command.match(/price\s+(\d+)/i);
    if (priceMatch) params.price = parseInt(priceMatch[1]);

    return params;
  }

  private extractGRParameters(command: string): Record<string, any> {
    const params: Record<string, any> = {};

    // Extract PO number
    const poMatch = command.match(/po\s+(\d+)/i);
    if (poMatch) params.poNumber = poMatch[1];

    return params;
  }

  private extractInvoiceParameters(command: string): Record<string, any> {
    const params: Record<string, any> = {};

    // Extract PO number
    const poMatch = command.match(/po\s+(\d+)/i);
    if (poMatch) params.poNumber = poMatch[1];

    // Extract amount
    const amountMatch = command.match(/amount\s+(\d+)/i);
    if (amountMatch) params.amount = parseInt(amountMatch[1]);

    return params;
  }

  private getTestSteps(action: string): string[] {
    switch (action) {
      case 'create_purchase_order':
        return [
          'Logging into SAP system',
          'Navigating to Create Purchase Order',
          'Filling supplier information',
          'Configuring organizational data',
          'Adding material line items',
          'Setting delivery date and pricing',
          'Assigning G/L account and cost center',
          'Saving purchase order',
          'Capturing PO number',
        ];

      case 'post_goods_receipt':
        return [
          'Logging into SAP system',
          'Navigating to Post Goods Movement',
          'Entering purchase order number',
          'Verifying line items',
          'Marking items as OK',
          'Posting goods receipt',
          'Confirming successful posting',
        ];

      case 'create_supplier_invoice':
        return [
          'Logging into SAP system',
          'Navigating to Create Supplier Invoice',
          'Entering company code',
          'Referencing purchase order',
          'Verifying balance',
          'Entering invoice amount',
          'Setting baseline date',
          'Posting invoice',
          'Confirming invoice creation',
        ];

      case 'complete_procurement_flow':
        return [
          'Logging into SAP system',
          'Creating purchase order',
          'Capturing PO number',
          'Navigating to goods receipt',
          'Posting goods receipt for PO',
          'Navigating to supplier invoice',
          'Creating invoice for PO',
          'Verifying end-to-end flow completion',
        ];

      default:
        return ['Executing test steps'];
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export const apiService = new ApiService();
