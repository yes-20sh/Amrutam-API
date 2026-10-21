import type { CreatePaymentDto } from './dto/create-payment.dto';
import type { ProcessPaymentDto } from './dto/process-payment.dto';
import type { CreatePaymentResponse } from './entities/create-payment-response.entity';
import type { PaymentEntity } from './entities/payment.entity';
import type { PaymentResolver as PaymentResolverType } from './payment.resolver';
import type { PaymentService as PaymentServiceType } from './payment.service';

const bunTest = require('bun:test') as {
  beforeAll: (callback: () => void | Promise<void>) => void;
  beforeEach: (callback: () => void | Promise<void>) => void;
  describe: (name: string, callback: () => void) => void;
  expect: jest.Expect;
  it: (name: string, callback: () => void | Promise<void>) => void;
  mock: {
    (): jest.Mock;
    module: (specifier: string, factory: () => unknown) => void;
  };
};
const { beforeAll, beforeEach, describe, expect, it } = bunTest;

bunTest.mock.module('../../schemas/payment.schema', () => ({
  Payment: class Payment {},
}));
bunTest.mock.module('../../schemas/consultation.schema', () => ({
  Consultation: class Consultation {},
}));
bunTest.mock.module('../../schemas/availability_slot.schema', () => ({
  AvailabilitySlot: class AvailabilitySlot {},
}));

let createResolver: (service: PaymentServiceType) => PaymentResolverType;

describe('PaymentResolver', () => {
  let resolver: PaymentResolverType;
  let paymentService: {
    createPayment: jest.Mock;
    processPayment: jest.Mock;
    refundPayment: jest.Mock;
    getPaymentById: jest.Mock;
    getPaymentsByConsultation: jest.Mock;
    myPayments: jest.Mock;
  };

  beforeAll(async () => {
    const { PaymentResolver } = await import('./payment.resolver.js');
    createResolver = (service) => new PaymentResolver(service);
  });

  beforeEach(() => {
    paymentService = {
      createPayment: bunTest.mock(),
      processPayment: bunTest.mock(),
      refundPayment: bunTest.mock(),
      getPaymentById: bunTest.mock(),
      getPaymentsByConsultation: bunTest.mock(),
      myPayments: bunTest.mock(),
    };
    resolver = createResolver(paymentService as unknown as PaymentServiceType);
  });

  it('forwards the patient ID and input when creating a payment', async () => {
    const patientId = 'patient-123';
    const input = {
      consultation_id: 'consultation-123',
      amount: '500.00',
      currency: 'INR',
      payment_method: 'UPI',
    } as CreatePaymentDto;
    const response = {
      message: 'Payment initiated successfully',
      payment_id: 'payment-123',
    } as CreatePaymentResponse;
    paymentService.createPayment.mockResolvedValue(response);

    await expect(resolver.createPayment(input, patientId)).resolves.toBe(
      response,
    );
    expect(paymentService.createPayment).toHaveBeenCalledWith(patientId, input);
  });

  it('forwards the user ID and input when processing a payment', async () => {
    const userId = 'patient-123';
    const input = {
      payment_id: 'payment-123',
      payment_status: 'PAID',
    } as ProcessPaymentDto;
    paymentService.processPayment.mockResolvedValue(
      'Payment processed successfully',
    );

    await expect(resolver.processPayment(input, userId)).resolves.toBe(
      'Payment processed successfully',
    );
    expect(paymentService.processPayment).toHaveBeenCalledWith(userId, input);
  });

  it('forwards the user and payment IDs when refunding', async () => {
    paymentService.refundPayment.mockResolvedValue(
      'Payment refunded successfully',
    );

    await expect(
      resolver.refundPayment('payment-123', 'patient-123'),
    ).resolves.toBe('Payment refunded successfully');
    expect(paymentService.refundPayment).toHaveBeenCalledWith(
      'patient-123',
      'payment-123',
    );
  });

  it('forwards the user and payment IDs when retrieving a payment', async () => {
    const payment = { payment_id: 'payment-123' } as PaymentEntity;
    paymentService.getPaymentById.mockResolvedValue(payment);

    await expect(
      resolver.getPaymentById(payment.payment_id, 'patient-123'),
    ).resolves.toBe(payment);
    expect(paymentService.getPaymentById).toHaveBeenCalledWith(
      'patient-123',
      payment.payment_id,
    );
  });

  it('forwards the user and consultation IDs when listing consultation payments', async () => {
    const payments = [{ payment_id: 'payment-123' }] as PaymentEntity[];
    paymentService.getPaymentsByConsultation.mockResolvedValue(payments);

    await expect(
      resolver.getPaymentsByConsultation('consultation-123', 'patient-123'),
    ).resolves.toBe(payments);
    expect(paymentService.getPaymentsByConsultation).toHaveBeenCalledWith(
      'patient-123',
      'consultation-123',
    );
  });

  it('forwards the user ID when listing their payments', async () => {
    const payments = [{ payment_id: 'payment-123' }] as PaymentEntity[];
    paymentService.myPayments.mockResolvedValue(payments);

    await expect(resolver.myPayments('patient-123')).resolves.toBe(payments);
    expect(paymentService.myPayments).toHaveBeenCalledWith('patient-123');
  });
});
